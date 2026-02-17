#!/usr/bin/env Rscript

# Inspect combined_sub.RData to understand its structure and origin

cat("=== Inspecting combined_sub.RData ===\n\n")

load("data/combined_sub.RData")

cat("Objects loaded:\n")
print(ls())
cat("\n")

# Inspect each object
for (obj_name in ls()) {
  obj <- get(obj_name)
  cat(sprintf("--- %s ---\n", obj_name))
  cat(sprintf("Class: %s\n", paste(class(obj), collapse=", ")))
  
  if (is.matrix(obj) || is.data.frame(obj)) {
    cat(sprintf("Dimensions: %d rows x %d columns\n", nrow(obj), ncol(obj)))
    cat("First few row names:\n")
    print(head(rownames(obj)))
    cat("First few column names:\n")
    print(head(colnames(obj)))
    if (ncol(obj) <= 20) {
      cat("All column names:\n")
      print(colnames(obj))
    }
  } else if (is.vector(obj) || is.factor(obj)) {
    cat(sprintf("Length: %d\n", length(obj)))
    cat("First few values:\n")
    print(head(obj))
    if (length(obj) <= 50) {
      cat("All values:\n")
      print(obj)
    }
    if (is.factor(obj)) {
      cat("Levels:\n")
      print(levels(obj))
      cat("Table:\n")
      print(table(obj))
    }
  } else if (is.list(obj)) {
    cat(sprintf("List with %d elements\n", length(obj)))
    cat("Names:\n")
    print(names(obj))
  }
  
  # Check for attributes that might indicate origin
  attrs <- attributes(obj)
  if (length(attrs) > 0) {
    cat("Attributes:\n")
    for (attr_name in names(attrs)) {
      if (!attr_name %in% c("dim", "dimnames", "names", "class", "row.names")) {
        cat(sprintf("  %s: ", attr_name))
        attr_val <- attr(obj, attr_name)
        if (length(attr_val) < 10) {
          print(attr_val)
        } else {
          cat(sprintf("<%s of length %d>\n", class(attr_val), length(attr_val)))
        }
      }
    }
  }
  
  cat("\n")
}

# Try to infer the dataset
cat("=== Analysis ===\n")
if (exists("train_expr")) {
  cat(sprintf("Training data: %d genes x %d samples\n", nrow(train_expr), ncol(train_expr)))
}
if (exists("y_train")) {
  cat(sprintf("Training labels: %d samples\n", length(y_train)))
  cat("Label distribution:\n")
  print(table(y_train))
}
if (exists("test_expr")) {
  cat(sprintf("Test data: %d genes x %d samples\n", nrow(test_expr), ncol(test_expr)))
}
if (exists("y_test")) {
  cat(sprintf("Test labels: %d samples\n", length(y_test)))
  cat("Label distribution:\n")
  print(table(y_test))
}

cat("\n=== Complete ===\n")
