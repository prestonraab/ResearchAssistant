export interface CitationNode {
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  citedBy: string[];
  cites: string[];
  citationCount: number;
  inCollectionCitationCount: number;
}

export interface CitationCluster {
  nodes: CitationNode[];
  centralPapers: string[];
  theme?: string;
}

export interface NetworkMetrics {
  totalPapers: number;
  totalCitations: number;
  averageCitationsPerPaper: number;
  foundationalPapers: CitationNode[];
  isolatedPapers: CitationNode[];
  clusters: CitationCluster[];
}

export class CitationNetworkAnalyzer {
  private nodes: Map<string, CitationNode> = new Map();

  /**
   * Build citation network from paper metadata
   */
  public buildNetwork(papers: any[]): CitationNode[] {
    this.nodes.clear();

    // Create nodes for all papers
    papers.forEach(paper => {
      const node: CitationNode = {
        paperId: paper.itemKey || paper.id,
        title: paper.title || 'Untitled',
        authors: paper.authors || [],
        year: paper.year || 0,
        citedBy: [],
        cites: [],
        citationCount: paper.citationCount || 0,
        inCollectionCitationCount: 0
      };
      this.nodes.set(node.paperId, node);
    });

    // Build citation relationships
    papers.forEach(paper => {
      const paperId = paper.itemKey || paper.id;
      const node = this.nodes.get(paperId);
      
      if (!node) {
        return;
      }

      // Extract citations from paper metadata
      if (paper.references && Array.isArray(paper.references)) {
        paper.references.forEach((refId: string) => {
          if (this.nodes.has(refId)) {
            node.cites.push(refId);
            const citedNode = this.nodes.get(refId);
            if (citedNode) {
              citedNode.citedBy.push(paperId);
              citedNode.inCollectionCitationCount++;
            }
          }
        });
      }

      // Also check for DOI-based citations if available
      if (paper.doi && paper.citedByDOIs && Array.isArray(paper.citedByDOIs)) {
        paper.citedByDOIs.forEach((citingDOI: string) => {
          // Find paper with this DOI in our collection
          const citingPaper = Array.from(this.nodes.values()).find(
            n => papers.find(p => (p.itemKey === n.paperId || p.id === n.paperId) && p.doi === citingDOI)
          );
          if (citingPaper && !node.citedBy.includes(citingPaper.paperId)) {
            node.citedBy.push(citingPaper.paperId);
            node.inCollectionCitationCount++;
          }
        });
      }
    });

    return Array.from(this.nodes.values());
  }

  /**
   * Find foundational papers (highly cited within the collection)
   */
  public findFoundationalPapers(threshold: number = 3): CitationNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.inCollectionCitationCount >= threshold)
      .sort((a, b) => b.inCollectionCitationCount - a.inCollectionCitationCount);
  }

  /**
   * Find isolated papers (no citations to/from other papers in collection)
   */
  public findIsolatedPapers(): CitationNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.citedBy.length === 0 && node.cites.length === 0);
  }

  /**
   * Find papers that cite a given paper
   */
  public getCitingPapers(paperId: string): CitationNode[] {
    const node = this.nodes.get(paperId);
    if (!node) {
      return [];
    }

    return node.citedBy
      .map(id => this.nodes.get(id))
      .filter((n): n is CitationNode => n !== undefined);
  }

  /**
   * Find papers cited by a given paper
   */
  public getCitedPapers(paperId: string): CitationNode[] {
    const node = this.nodes.get(paperId);
    if (!node) {
      return [];
    }

    return node.cites
      .map(id => this.nodes.get(id))
      .filter((n): n is CitationNode => n !== undefined);
  }

  /**
   * Find citation clusters using simple connected components
   */
  public findClusters(): CitationCluster[] {
    const visited = new Set<string>();
    const clusters: CitationCluster[] = [];

    for (const node of this.nodes.values()) {
      if (visited.has(node.paperId)) {
        continue;
      }

      const cluster = this.exploreCluster(node.paperId, visited);
      if (cluster.length > 1) {
        // Find central papers in cluster (most connected)
        const centralPapers = cluster
          .sort((a, b) => {
            const aConnections = a.citedBy.length + a.cites.length;
            const bConnections = b.citedBy.length + b.cites.length;
            return bConnections - aConnections;
          })
          .slice(0, 3)
          .map(n => n.paperId);

        clusters.push({
          nodes: cluster,
          centralPapers
        });
      }
    }

    return clusters.sort((a, b) => b.nodes.length - a.nodes.length);
  }

  /**
   * Explore a cluster using BFS
   */
  private exploreCluster(startId: string, visited: Set<string>): CitationNode[] {
    const cluster: CitationNode[] = [];
    const queue: string[] = [startId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      const node = this.nodes.get(currentId);
      
      if (!node) {
        continue;
      }

      cluster.push(node);

      // Add connected papers to queue
      node.citedBy.forEach(id => {
        if (!visited.has(id)) {
          queue.push(id);
        }
      });
      
      node.cites.forEach(id => {
        if (!visited.has(id)) {
          queue.push(id);
        }
      });
    }

    return cluster;
  }

  /**
   * Calculate network metrics
   */
  public calculateMetrics(): NetworkMetrics {
    const nodes = Array.from(this.nodes.values());
    const totalPapers = nodes.length;
    const totalCitations = nodes.reduce((sum, n) => sum + n.inCollectionCitationCount, 0);
    const averageCitationsPerPaper = totalPapers > 0 ? totalCitations / totalPapers : 0;

    return {
      totalPapers,
      totalCitations,
      averageCitationsPerPaper,
      foundationalPapers: this.findFoundationalPapers(),
      isolatedPapers: this.findIsolatedPapers(),
      clusters: this.findClusters()
    };
  }

  /**
   * Get shortest path between two papers
   */
  public getShortestPath(fromId: string, toId: string): CitationNode[] | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === toId) {
        return path.map(id => this.nodes.get(id)!);
      }

      if (visited.has(id)) {
        continue;
      }

      visited.add(id);
      const node = this.nodes.get(id);

      if (!node) {
        continue;
      }

      // Add neighbors to queue
      const neighbors = [...node.citedBy, ...node.cites];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          queue.push({ id: neighborId, path: [...path, neighborId] });
        }
      });
    }

    return null; // No path found
  }

  /**
   * Get papers within N citation hops of a given paper
   */
  public getPapersWithinHops(paperId: string, maxHops: number): CitationNode[] {
    if (!this.nodes.has(paperId)) {
      return [];
    }

    const visited = new Set<string>();
    const result: CitationNode[] = [];
    const queue: Array<{ id: string; hops: number }> = [{ id: paperId, hops: 0 }];

    while (queue.length > 0) {
      const { id, hops } = queue.shift()!;

      if (visited.has(id) || hops > maxHops) {
        continue;
      }

      visited.add(id);
      const node = this.nodes.get(id);

      if (!node) {
        continue;
      }

      if (hops > 0) {
        result.push(node);
      }

      if (hops < maxHops) {
        const neighbors = [...node.citedBy, ...node.cites];
        neighbors.forEach(neighborId => {
          if (!visited.has(neighborId)) {
            queue.push({ id: neighborId, hops: hops + 1 });
          }
        });
      }
    }

    return result;
  }

  /**
   * Export network data for visualization
   */
  public exportForVisualization(): {
    nodes: Array<{ id: string; label: string; size: number; year: number }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      id: node.paperId,
      label: node.title.length > 50 ? node.title.substring(0, 47) + '...' : node.title,
      size: Math.max(5, node.inCollectionCitationCount * 2),
      year: node.year
    }));

    const edges: Array<{ from: string; to: string }> = [];
    this.nodes.forEach(node => {
      node.cites.forEach(citedId => {
        edges.push({ from: node.paperId, to: citedId });
      });
    });

    return { nodes, edges };
  }
}
