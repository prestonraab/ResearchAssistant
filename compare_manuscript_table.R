#!/usr/bin/env Rscript

# Compare manuscript table with actual data

cat("\n=== MANUSCRIPT TABLE vs ACTUAL DATA COMPARISON ===\n\n")

# Load actual data
load("data/TB_real_data.RData")

# Manuscript table data (as written)
manuscript <- data.frame(
  Study = c("Zak et al. (2016)", "Suliman et al. (2018)", "Anderson et al. (2014)", 
            "Leong et al. (2018)", "Kaforou et al. (2013)", "Low-Endemic Comparators"),
  GEO = c("GSE79362", "GSE94438", "GSE39941", "GSE101705", "GSE37250", "GSE19491, GSE42834"),
  Region = c("South Africa", "SA/Gambia/Ethiopia", "SA/Malawi/Kenya", "India", "SA/Malawi", "USA/UK/Multi"),
  Population = c("Adolescents (12-18)", "Adults", "Children (<15)", "Adults", "Adults (18+)", "Adults/Mixed"),
  Manuscript_Total = c(153, 407, 334, 44, 584, 440),
  Manuscript_Active = c(NA, NA, 111, 28, 195, 61),
  Manuscript_Latent = c(NA, NA, 54, 16, 167, 69),
  Manuscript_Progressors = c(46, 79, NA, NA, NA, NA),
  Manuscript_NonProgressors = c(107, 328, NA, NA, NA, NA),
  Manuscript_Other = c(NA, NA, 169, NA, 222, 310),
  stringsAsFactors = FALSE
)

# Actual data
actual <- data.frame(
  Dataset = c("Africa", "India", "GSE39941_M", "GSE37250_SA", "GSE37250_M", "USA"),
  Actual_Total = c(ncol(dat_lst$Africa), ncol(dat_lst$India), ncol(dat_lst$GSE39941_M),
                   ncol(dat_lst$GSE37250_SA), ncol(dat_lst$GSE37250_M), ncol(dat_lst$USA)),
  Actual_Active = c(sum(label_lst$Africa == 1), sum(label_lst$India == 1), sum(label_lst$GSE39941_M == 1),
                    sum(label_lst$GSE37250_SA == 1), sum(label_lst$GSE37250_M == 1), sum(label_lst$USA == 1)),
  Actual_Latent = c(sum(label_lst$Africa == 0), sum(label_lst$India == 0), sum(label_lst$GSE39941_M == 0),
                    sum(label_lst$GSE37250_SA == 0), sum(label_lst$GSE37250_M == 0), sum(label_lst$USA == 0)),
  GEO_Match = c("GSE79362", "GSE107994", "GSE39941", "GSE37250", "GSE37250", "GSE73408"),
  stringsAsFactors = FALSE
)

cat("MANUSCRIPT TABLE (as written):\n")
cat("==============================\n\n")
print(manuscript[, c("Study", "GEO", "Region", "Manuscript_Total", "Manuscript_Active", "Manuscript_Latent")])

cat("\n\nACTUAL DATA (in TB_real_data.RData):\n")
cat("====================================\n\n")
print(actual)

cat("\n\nDISCREPANCIES:\n")
cat("==============\n\n")

# Africa / GSE79362
cat("1. AFRICA (GSE79362 - Zak et al. 2016):\n")
cat("   Manuscript: 153 samples (46 progressors, 107 non-progressors)\n")
cat("   Actual:     181 samples (77 active TB, 104 latent TB)\n")
cat("   Issue:      Different sample count AND different labels\n")
cat("               - Manuscript describes progression study\n")
cat("               - Actual data uses active/latent classification\n")
cat("               - 181 samples suggests using ALL samples, not just progressors\n\n")

# India
cat("2. INDIA:\n")
cat("   Manuscript: GSE101705, 44 samples (28 active, 16 latent) - Leong et al. 2018\n")
cat("   Actual:     GSE107994, 103 samples (53 active, 50 latent) - Leong et al. 2018\n")
cat("   Issue:      WRONG GEO ACCESSION in manuscript\n")
cat("               - Should be GSE107994, not GSE101705\n")
cat("               - Using Leicester UK cohort (South Asian descent)\n")
cat("               - Much larger sample size than manuscript states\n\n")

# GSE39941
cat("3. GSE39941 (Anderson et al. 2014):\n")
cat("   Manuscript: 334 samples (111 active, 54 latent, 169 other)\n")
cat("   Actual:     70 samples (20 active, 50 latent) - Malawi subset only\n")
cat("   Issue:      Using filtered subset\n")
cat("               - HIV-negative only\n")
cat("               - Malawi region only (not SA/Kenya)\n")
cat("               - Removed 'other' disease states\n")
cat("               - Much smaller than full study\n\n")

# GSE37250
cat("4. GSE37250 (Kaforou et al. 2013):\n")
cat("   Manuscript: 584 samples (195 active, 167 latent, 222 other)\n")
cat("   Actual:     180 samples total, split into:\n")
cat("               - GSE37250_SA: 94 samples (46 active, 48 latent)\n")
cat("               - GSE37250_M:  86 samples (51 active, 35 latent)\n")
cat("   Issue:      Using filtered subsets\n")
cat("               - HIV-negative only\n")
cat("               - Split by region (SA vs Malawi)\n")
cat("               - Removed 'other' disease states\n")
cat("               - Much smaller than full study\n\n")

# USA
cat("5. USA:\n")
cat("   Manuscript: GSE19491/GSE42834, 440 samples (61 active, 69 latent, 310 other)\n")
cat("   Actual:     GSE73408, 70 samples (35 active, 35 latent)\n")
cat("   Issue:      COMPLETELY DIFFERENT STUDY\n")
cat("               - Manuscript lists GSE19491/GSE42834\n")
cat("               - Actually using GSE73408 (Walter et al. 2016)\n")
cat("               - Different sample counts\n\n")

# Missing studies
cat("6. MISSING FROM ACTUAL DATA:\n")
cat("   - GSE94438 (Suliman et al. 2018) - NOT USED\n")
cat("   - GSE19491/GSE42834 - NOT USED\n\n")

cat("\n\nSUMMARY:\n")
cat("========\n\n")
cat("The manuscript table does NOT accurately describe the data being analyzed.\n")
cat("Major issues:\n")
cat("  1. Wrong GEO accessions (India, USA)\n")
cat("  2. Wrong sample counts (all datasets)\n")
cat("  3. Wrong label types (Africa: progressors vs active/latent)\n")
cat("  4. Missing information about filtering (HIV-negative, geographic subsets)\n")
cat("  5. Two studies in manuscript (GSE94438, GSE19491/GSE42834) are NOT used\n\n")

cat("RECOMMENDATION:\n")
cat("===============\n")
cat("Update the manuscript table to reflect the ACTUAL data:\n\n")

# Create corrected table
corrected <- data.frame(
  Study = c("Zak et al. (2016)", "Leong et al. (2018)", "Anderson et al. (2014)",
            "Kaforou et al. (2013) - SA", "Kaforou et al. (2013) - Malawi", "Walter et al. (2016)"),
  GEO = c("GSE79362", "GSE107994", "GSE39941", "GSE37250", "GSE37250", "GSE73408"),
  Region = c("South Africa", "UK (South Asian)", "Malawi", "South Africa", "Malawi", "USA"),
  Population = c("Adolescents (12-18)", "Adults", "Children (<15)", "Adults (18+)", "Adults (18+)", "Adults"),
  Samples = c(181, 103, 70, 94, 86, 70),
  Active = c(77, 53, 20, 46, 51, 35),
  Latent = c(104, 50, 50, 48, 35, 35),
  Platform = c("RNA-seq", "RNA-seq", "Microarray", "Microarray", "Microarray", "Microarray"),
  Notes = c("Training set only", "Leicester cohort", "HIV-neg, Malawi only", "HIV-neg, SA only", "HIV-neg, Malawi only", "Removed pneumonia"),
  stringsAsFactors = FALSE
)

cat("\nCORRECTED TABLE:\n")
print(corrected)

cat("\n=== END OF COMPARISON ===\n")
