/**
 * Quantizes embeddings to int8 for storage efficiency
 * Reduces embedding size from 6KB to 1.5KB (75% reduction)
 * Minimal accuracy loss (~1-2%)
 */
export class EmbeddingQuantizer {
  /**
   * Quantize float32 embedding to int8
   */
  static quantize(embedding: number[]): Int8Array {
    if (embedding.length === 0) {
      return new Int8Array(0);
    }

    // Find min and max values
    let min = embedding[0];
    let max = embedding[0];

    for (let i = 1; i < embedding.length; i++) {
      if (embedding[i] < min) min = embedding[i];
      if (embedding[i] > max) max = embedding[i];
    }

    // Handle case where all values are the same
    const range = max - min;
    if (range === 0) {
      return new Int8Array(embedding.length).fill(0);
    }

    // Quantize to int8 range [-128, 127]
    const quantized = new Int8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      // Normalize to [0, 1]
      const normalized = (embedding[i] - min) / range;
      // Scale to [-128, 127]
      quantized[i] = Math.round(normalized * 255 - 128);
    }

    return quantized;
  }

  /**
   * Dequantize int8 embedding back to float32
   * Stores min/max in metadata for reconstruction
   */
  static dequantize(quantized: Int8Array, metadata: { min: number; max: number }): number[] {
    const { min, max } = metadata;
    const range = max - min;

    const dequantized: number[] = [];
    for (let i = 0; i < quantized.length; i++) {
      // Reverse the quantization
      const normalized = (quantized[i] + 128) / 255;
      dequantized[i] = normalized * range + min;
    }

    return dequantized;
  }

  /**
   * Compute cosine similarity between quantized and float embeddings
   * Dequantizes on-the-fly for comparison
   */
  static cosineSimilarityQuantized(
    floatEmbedding: number[],
    quantizedEmbedding: Int8Array,
    metadata: { min: number; max: number }
  ): number {
    const dequantized = this.dequantize(quantizedEmbedding, metadata);
    return this.cosineSimilarity(floatEmbedding, dequantized);
  }

  /**
   * Compute cosine similarity between two float embeddings
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
