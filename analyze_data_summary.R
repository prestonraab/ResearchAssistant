#!/usr/bin/env Rscript

# ==============================================================================
# TB Data Summary & Export Script
# ==============================================================================
# Purpose: Generate comprehensive summary statistics from RData files and
#          export human-readable CSV/JSON formats
# ==============================================================================

suppressMessages({
  library(jsonlite)
})

# ==============================================================================
# Configuration
# ==============================================================================

OUTPUT_DIR <- "data/exported"
REPORT_FILE <- "data/data_provenance_report.txt"

# ==============================================================================
# Helper Functions
# ==============================================================================

summarize_dataset <- function(dat, labels, dataset_name) {
  # Generate comprehensive statistics for a single dataset
  
  n_samples <- ncol(dat)
  n_genes <- nrow(dat)
  n_active <- sum(labels == 1)
  n_latent <- sum(labels == 0)
  n_other <- sum(labels != 0 & labels != 1)
  
  # Expression statistics
  expr_min <- min(dat, na.rm = TRUE)
  expr_max <- max(dat, na.rm = TRUE)
  expr_mean <- mean(dat, na.rm = TRUE)
  expr_median <- median(dat, na.rm = TRUE)
  expr_sd <- sd(as.vector(dat), na.rm = TRUE)
  
  # Per-sample statistics
  sample_means <- colMeans(dat, na.rm = TRUE)
  sample_sds <- apply(dat, 2, sd, na.rm = TRUE)
  
  # Per-gene statistics
  gene_means <- rowMeans(dat, na.rm = TRUE)
  gene_vars <- apply(dat, 1, var, na.rm = TRUE)
  gene_sds <- sqrt(gene_vars)
  
  # Missing data
  n_missing <- sum(is.na(dat))
  pct_missing <- round(n_missing / (nrow(dat) * ncol(dat)) * 100, 2)
  
  # Zero values
  n_zeros <- sum(dat == 0, na.rm = TRUE)
  pct_zeros <- round(n_zeros / (nrow(dat) * ncol(dat)) * 100, 2)
  
  list(
    dataset = dataset_name,
    n_samples = n_samples,
    n_genes = n_genes,
    n_active_tb = n_active,
    n_latent_tb = n_latent,
    n_other = n_other,
    pct_active = round(n_active / n_samples * 100, 2),
    pct_latent = round(n_latent / n_samples * 100, 2),
    
    # Expression value ranges
    expr_min = round(expr_min, 4),
    expr_max = round(expr_max, 4),
    expr_mean = round(expr_mean, 4),
    expr_median = round(expr_median, 4),
    expr_sd = round(expr_sd, 4),
    
    # Per-sample statistics
    sample_mean_min = round(min(sample_means), 4),
    sample_mean_max = round(max(sample_means), 4),
    sample_mean_avg = round(mean(sample_means), 4),
    sample_sd_min = round(min(sample_sds), 4),
    sample_sd_max = round(max(sample_sds), 4),
    sample_sd_avg = round(mean(sample_sds), 4),
    
    # Per-gene statistics
    gene_mean_min = round(min(gene_means), 4),
    gene_mean_max = round(max(gene_means), 4),
    gene_mean_avg = round(mean(gene_means), 4),
    gene_sd_min = round(min(gene_sds, na.rm = TRUE), 4),
    gene_sd_max = round(max(gene_sds, na.rm = TRUE), 4),
    gene_sd_avg = round(mean(gene_sds, na.rm = TRUE), 4),
    
    # Data quality
    n_missing = n_missing,
    pct_missing = pct_missing,
    n_zeros = n_zeros,
    pct_zeros = pct_zeros,
    n_zero_variance_genes = sum(gene_vars == 0, na.rm = TRUE)
  )
}

export_dataset_to_csv <- function(dat, labels, dataset_name, output_dir = OUTPUT_DIR) {
  # Export expression matrix and labels to CSV
  
  dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)
  
  # Create data frame with gene names
  df <- as.data.frame(dat)
  df <- cbind(gene = rownames(dat), df)
  
  # Export expression data (first 100 genes as preview, full data can be large)
  expr_preview_file <- file.path(output_dir, paste0(dataset_name, "_expression_preview.csv"))
  write.csv(df[1:min(100, nrow(df)), ], expr_preview_file, row.names = FALSE)
  
  # Export full expression data
  expr_file <- file.path(output_dir, paste0(dataset_name, "_expression_full.csv"))
  write.csv(df, expr_file, row.names = FALSE)
  
  # Export labels with more detail
  label_df <- data.frame(
    sample_id = colnames(dat),
    sample_index = 1:ncol(dat),
    label_numeric = labels,
    status = ifelse(labels == 1, "Active_TB", 
                   ifelse(labels == 0, "Latent_TB", "Other")),
    mean_expression = colMeans(dat, na.rm = TRUE),
    sd_expression = apply(dat, 2, sd, na.rm = TRUE)
  )
  label_file <- file.path(output_dir, paste0(dataset_name, "_sample_info.csv"))
  write.csv(label_df, label_file, row.names = FALSE)
  
  # Export gene-level statistics
  gene_stats <- data.frame(
    gene = rownames(dat),
    mean_expr = rowMeans(dat, na.rm = TRUE),
    sd_expr = apply(dat, 1, sd, na.rm = TRUE),
    min_expr = apply(dat, 1, min, na.rm = TRUE),
    max_expr = apply(dat, 1, max, na.rm = TRUE),
    n_zeros = rowSums(dat == 0, na.rm = TRUE),
    pct_zeros = round(rowSums(dat == 0, na.rm = TRUE) / ncol(dat) * 100, 2)
  )
  gene_file <- file.path(output_dir, paste0(dataset_name, "_gene_stats.csv"))
  write.csv(gene_stats, gene_file, row.names = FALSE)
  
  cat(sprintf("  Exported %s:\n", dataset_name))
  cat(sprintf("    - %s (preview)\n", basename(expr_preview_file)))
  cat(sprintf("    - %s (full data)\n", basename(expr_file)))
  cat(sprintf("    - %s\n", basename(label_file)))
  cat(sprintf("    - %s\n", basename(gene_file)))
  
  return(list(
    expr_preview = expr_preview_file,
    expr_full = expr_file, 
    labels = label_file,
    gene_stats = gene_file
  ))
}

# ==============================================================================
# Main Analysis
# ==============================================================================

cat("\n=== TB DATA SUMMARY & EXPORT ===\n\n")

# Initialize results
all_summaries <- list()
export_info <- list()
report_lines <- c()

# Start building report
report_lines <- c(report_lines, 
  "================================================================================",
  "TB DATASET PROVENANCE AND SUMMARY REPORT",
  "================================================================================",
  paste("Generated:", Sys.time()),
  "",
  "This report documents the datasets used in the TB batch effects analysis,",
  "including their sources, processing steps, and key statistics.",
  "",
  "================================================================================",
  "DATA SOURCES AND PROCESSING PIPELINE",
  "================================================================================",
  ""
)

# ==============================================================================
# Analyze TB_real_data.RData (Main training/validation data)
# ==============================================================================

cat("Analyzing TB_real_data.RData...\n\n")

report_lines <- c(report_lines,
  "PRIMARY DATA FILE: data/TB_real_data.RData",
  "Created by: scripts/2_TB_getdata.R",
  "",
  "This file contains harmonized gene expression data from 6 TB studies.",
  "All datasets have been:",
  "  - Filtered to common genes (intersection across all studies)",
  "  - Variance filtered (genes with variance > 0 in all batches)",
  "  - Subset to Active TB vs Latent TB samples only",
  "",
  "--------------------------------------------------------------------------------",
  "DATASET DETAILS",
  "--------------------------------------------------------------------------------",
  ""
)

if (file.exists("data/TB_real_data.RData")) {
  load("data/TB_real_data.RData")
  
  # Document each dataset
  dataset_info <- list(
    USA = list(
      geo_id = "GSE73408",
      citation = "Walter et al. (2016)",
      population = "US Adults (Denver, CO)",
      platform = "Affymetrix HuGene 1.1 ST (Microarray)",
      processing = "Downloaded from GEO, filtered to TB/LTBI (removed pneumonia cases)",
      notes = "HIV status not specified in filtering"
    ),
    Africa = list(
      geo_id = "GSE79362",
      citation = "Zak et al. (2016)",
      population = "South African Adolescents (Western Cape, 12-18 years)",
      platform = "Illumina RNA-seq",
      processing = "Loaded from data/combined_sub.RData (pre-processed RNA-seq)",
      notes = "Uses training set only (181 samples); test set (399 samples) not used"
    ),
    India = list(
      geo_id = "GSE107994",
      citation = "Leong et al. (2018)",
      population = "UK Residents of South Asian descent (Leicester) - used as India proxy",
      platform = "Illumina RNA-seq (HT-12 v4 equivalent)",
      processing = "Loaded from Excel file: data/GSE107994/GSE107994_edgeR_normalized_Leicester_with_progressor_longitudinal.xlsx",
      notes = "Filtered to Active_TB and Control groups only"
    ),
    GSE37250_SA = list(
      geo_id = "GSE37250",
      citation = "Kaforou et al. (2013)",
      population = "South African Adults (18+)",
      platform = "Illumina HumanHT-12 v4 (Microarray)",
      processing = "Downloaded from GEO, filtered to: HIV-negative, South Africa region, Active TB or Latent TB",
      notes = "Subset of larger study that included HIV+ and other disease states"
    ),
    GSE37250_M = list(
      geo_id = "GSE37250",
      citation = "Kaforou et al. (2013)",
      population = "Malawian Adults (18+)",
      platform = "Illumina HumanHT-12 v4 (Microarray)",
      processing = "Downloaded from GEO, filtered to: HIV-negative, Malawi region, Active TB or Latent TB",
      notes = "Same study as GSE37250_SA but different geographic subset"
    ),
    GSE39941_M = list(
      geo_id = "GSE39941",
      citation = "Anderson et al. (2014) / Berry et al.",
      population = "Malawian Children (<15 years)",
      platform = "Illumina HumanHT-12 v4 (Microarray)",
      processing = "Downloaded from GEO, filtered to: HIV-negative, Malawi region, Active TB or Latent TB",
      notes = "Original study included other disease states (169 other samples removed)"
    )
  )
  
  for (dataset_name in names(dat_lst)) {
    cat(sprintf("Processing %s...\n", dataset_name))
    
    # Generate statistics
    summary <- summarize_dataset(dat_lst[[dataset_name]], 
                                 label_lst[[dataset_name]], 
                                 dataset_name)
    all_summaries[[dataset_name]] <- summary
    
    # Export to CSV
    export_info[[dataset_name]] <- export_dataset_to_csv(
      dat_lst[[dataset_name]], 
      label_lst[[dataset_name]], 
      dataset_name
    )
    
    # Add to report
    info <- dataset_info[[dataset_name]]
    report_lines <- c(report_lines,
      sprintf("DATASET: %s", dataset_name),
      sprintf("  GEO Accession: %s", info$geo_id),
      sprintf("  Citation: %s", info$citation),
      sprintf("  Population: %s", info$population),
      sprintf("  Platform: %s", info$platform),
      sprintf("  Samples: %d (%d Active TB, %d Latent TB, %.1f%% active)",
              summary$n_samples, summary$n_active_tb, summary$n_latent_tb, summary$pct_active),
      sprintf("  Genes: %d", summary$n_genes),
      sprintf("  Expression range: [%.2f, %.2f] (mean: %.2f, SD: %.2f)",
              summary$expr_min, summary$expr_max, summary$expr_mean, summary$expr_sd),
      sprintf("  Processing: %s", info$processing),
      sprintf("  Notes: %s", info$notes),
      ""
    )
    
    cat("\n")
  }
} else {
  cat("  WARNING: TB_real_data.RData not found!\n")
  report_lines <- c(report_lines, "ERROR: TB_real_data.RData not found!")
}

# ==============================================================================
# Analyze combined_sub.RData (Africa source data)
# ==============================================================================

cat("Analyzing combined_sub.RData (Africa source)...\n\n")

report_lines <- c(report_lines,
  "--------------------------------------------------------------------------------",
  "SOURCE DATA: data/combined_sub.RData",
  "--------------------------------------------------------------------------------",
  "",
  "This file contains the pre-processed RNA-seq data for GSE79362 (Zak et al.).",
  "It includes both training and test sets with SRA run accessions as sample IDs.",
  ""
)

if (file.exists("data/combined_sub.RData")) {
  load("data/combined_sub.RData")
  
  report_lines <- c(report_lines,
    "Contents:",
    sprintf("  - train_expr: %d genes x %d samples", nrow(train_expr), ncol(train_expr)),
    sprintf("  - y_train: %d labels (Active TB: %d, Latent TB: %d)",
            length(y_train), sum(y_train == 1), sum(y_train == 0)),
    sprintf("  - test_expr: %d genes x %d samples", nrow(test_expr), ncol(test_expr)),
    sprintf("  - y_test: %d labels (Active TB: %d, Latent TB: %d)",
            length(y_test), sum(y_test == 1), sum(y_test == 0)),
    "",
    "Sample ID format: SRA run accessions (SRR numbers)",
    sprintf("  - Training samples: %s ... %s", 
            colnames(train_expr)[1], colnames(train_expr)[ncol(train_expr)]),
    sprintf("  - Test samples: %s ... %s",
            colnames(test_expr)[1], colnames(test_expr)[ncol(test_expr)]),
    "",
    "Usage in analysis:",
    "  - Training set (181 samples) is used as 'Africa' dataset",
    "  - Test set (399 samples) is NOT used in current analysis",
    "",
    "Origin: Likely processed from raw FASTQ files downloaded from NCBI SRA",
    "        (alignment and quantification pipeline unknown)",
    ""
  )
} else {
  report_lines <- c(report_lines, "WARNING: combined_sub.RData not found!", "")
}

# ==============================================================================
# Create Summary Tables
# ==============================================================================

cat("Creating summary tables...\n")

# Convert to data frame
summary_df <- do.call(rbind, lapply(all_summaries, as.data.frame))

# Save comprehensive summary
write.csv(summary_df, "data/dataset_summary_statistics.csv", row.names = FALSE)
cat("  Saved: data/dataset_summary_statistics.csv\n")

# Save as JSON for easy inspection
write_json(all_summaries, "data/dataset_summary_statistics.json", pretty = TRUE, auto_unbox = TRUE)
cat("  Saved: data/dataset_summary_statistics.json\n\n")

# ==============================================================================
# Add Summary Statistics to Report
# ==============================================================================

report_lines <- c(report_lines,
  "================================================================================",
  "SUMMARY STATISTICS",
  "================================================================================",
  "",
  sprintf("%-15s %8s %8s %8s %8s %12s %12s", 
          "Dataset", "Samples", "Genes", "Active", "Latent", "Expr_Min", "Expr_Max"),
  sprintf("%-15s %8s %8s %8s %8s %12s %12s",
          "---------------", "--------", "--------", "--------", "--------", "------------", "------------")
)

for (ds in names(dat_lst)) {
  s <- all_summaries[[ds]]
  report_lines <- c(report_lines,
    sprintf("%-15s %8d %8d %8d %8d %12.2f %12.2f",
            s$dataset, s$n_samples, s$n_genes, s$n_active_tb, s$n_latent_tb,
            s$expr_min, s$expr_max)
  )
}

report_lines <- c(report_lines,
  "",
  "Notes:",
  "  - All datasets share the same gene set (intersection of all studies)",
  "  - Expression values vary by platform (microarray vs RNA-seq)",
  "  - Microarray data (GSE37250*, GSE39941*) has wider range due to probe intensities",
  "  - RNA-seq data (Africa, India) shows log-transformed counts",
  "  - USA data (microarray) shows log2-transformed intensities",
  ""
)

# ==============================================================================
# Add Key Findings
# ==============================================================================

report_lines <- c(report_lines,
  "================================================================================",
  "KEY FINDINGS AND DISCREPANCIES",
  "================================================================================",
  "",
  "1. SAMPLE COUNTS:",
  "   The actual sample counts differ from some published studies because:",
  "   - Filtering to HIV-negative samples only",
  "   - Filtering to specific geographic regions",
  "   - Removing samples with other disease states",
  "   - Using only Active TB vs Latent TB (excluding progressors, other controls)",
  "",
  "2. GENE COUNTS:",
  sprintf("   All datasets harmonized to %d common genes", all_summaries[[1]]$n_genes),
  "   - Original studies had different gene coverage",
  "   - Intersection ensures all genes present across all platforms",
  "   - Variance filtering removed low-quality genes",
  "",
  "3. EXPRESSION SCALES:",
  "   Different platforms have different expression scales:",
  "   - RNA-seq: log-transformed normalized counts (range: -6 to 16)",
  "   - Microarray: probe intensities (range: -73 to 65,896)",
  "   - This is expected and handled by batch correction methods",
  "",
  "4. DATA PROVENANCE:",
  "   - USA, GSE37250*, GSE39941*: Downloaded directly from GEO",
  "   - Africa: Pre-processed RNA-seq from combined_sub.RData",
  "   - India: Pre-processed from Excel file (edgeR normalized)",
  "",
  "5. MISSING SOURCE:",
  "   - combined_sub.RData origin unknown (no generation script found)",
  "   - Contains pre-processed GSE79362 data with train/test split",
  "   - Sample IDs are SRA accessions suggesting raw data processing",
  ""
)

# ==============================================================================
# Add Output Files Section
# ==============================================================================

report_lines <- c(report_lines,
  "================================================================================",
  "OUTPUT FILES",
  "================================================================================",
  "",
  "Summary Statistics:",
  "  - data/dataset_summary_statistics.csv (comprehensive statistics table)",
  "  - data/dataset_summary_statistics.json (JSON format)",
  "  - data/data_provenance_report.txt (this report)",
  "",
  "Exported Data (data/exported/):",
  ""
)

for (ds in names(dat_lst)) {
  report_lines <- c(report_lines,
    sprintf("  %s:", ds),
    sprintf("    - %s_expression_preview.csv (first 100 genes)", ds),
    sprintf("    - %s_expression_full.csv (complete expression matrix)", ds),
    sprintf("    - %s_sample_info.csv (sample metadata and labels)", ds),
    sprintf("    - %s_gene_stats.csv (per-gene statistics)", ds),
    ""
  )
}

report_lines <- c(report_lines,
  "================================================================================",
  "END OF REPORT",
  "================================================================================",
  ""
)

# ==============================================================================
# Write Report to File
# ==============================================================================

writeLines(report_lines, REPORT_FILE)
cat(sprintf("Full report saved to: %s\n\n", REPORT_FILE))

# ==============================================================================
# Print Summary Report to Console
# ==============================================================================

cat("=== SUMMARY REPORT ===\n\n")

for (ds in names(dat_lst)) {
  s <- all_summaries[[ds]]
  cat(sprintf("%s\n", s$dataset))
  cat(sprintf("  Samples: %d (%d active TB, %d latent TB)\n", 
              s$n_samples, s$n_active_tb, s$n_latent_tb))
  cat(sprintf("  Genes: %d\n", s$n_genes))
  cat(sprintf("  Expression range: [%.2f, %.2f] (mean: %.2f, SD: %.2f)\n",
              s$expr_min, s$expr_max, s$expr_mean, s$expr_sd))
  cat(sprintf("  Missing data: %.2f%%, Zeros: %.2f%%\n",
              s$pct_missing, s$pct_zeros))
  cat("\n")
}

cat("Output files:\n")
cat("  - data/dataset_summary_statistics.csv (all statistics)\n")
cat("  - data/dataset_summary_statistics.json (JSON format)\n")
cat(sprintf("  - %s (full provenance report)\n", REPORT_FILE))
cat("  - data/exported/ (individual dataset files)\n")
cat("\n=== COMPLETE ===\n")
