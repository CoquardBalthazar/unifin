import c24 as c24
import bp as bp
import combine_bank_data as cbd

'''
Commands : 
  # Open Ubuntu in File Explorer
  >>> explorer.exe . 
  # Network wsl.localhost Ubuntu home bcubuntu projects _private ofxToCSV_private
  # Run scripts (adapt file path before)
  >>> python3 bank/run.py
'''

# Variable definition ###################################
## Input File Paths -------------------
bp_file_path = "/home/bcubuntu/projects/_private/ofxToCSV_private/data/bp/tsv/20250418_90j_März-2143295S0381744973694118.tsv"
c24_file_path = "/home/bcubuntu/projects/_private/ofxToCSV_private/data/c24/20250418_90j_März-Transaktionen.csv"

## Output File Paths -----------------
output_bp = "/home/bcubuntu/projects/_private/ofxToCSV_private/output/bp/Converter-bp_20250418_90j_März.csv"
output_c24 = "/home/bcubuntu/projects/_private/ofxToCSV_private/output/c24/Converter-c24_20250418_90j_März.csv"
output_all = "/home/bcubuntu/projects/_private/ofxToCSV_private/output/Converter-all_20250418_90j_März.csv"


# Convert to pd.DataFrames ###########################################
## bp TSV to pd.Df ----------------------------
df_bp = bp.tsv_to_pdDf(bp_file_path)
# print(df_bp.dtypes)
# print(df_bp.head(30))

# ## c24 CSV to pd.Df ----------------------------
df_c24 = c24.csv_to_pdDf(c24_file_path)
# print(df_c24.dtypes)
# print(df_c24.head(30))


# ## Combined bank data ----------------------------
merged = cbd.merge_transactions(transactions_to_merge=[df_bp, df_c24])
# # print(merged[["Bank", "Date", "Name", "Amount"]].head(200))
# # print(merged.columns)
# # print(merged.dtypes)





# Write to CSV #######################################################################
## La Banque Postale ------------------------
try : 
  cbd.write_to_csv(pdDf_input=df_bp, output_csv_filepath=output_bp) # La Banque Postale
  print(f"Conversion La Banque Postale completed")
except TypeError:
  print(f"Failed to convert for La Banque postale")

## C24 Bank -----------------------
try : 
  cbd.write_to_csv(pdDf_input=df_c24, output_csv_filepath=output_c24) # C24 Bank
  print(f"Conversion C24 completed")
except TypeError:
  print(f"Failed to convert for C24 Bank")

## All - Merged -----------------------
try : 
  cbd.write_to_csv(pdDf_input=merged, output_csv_filepath=output_all) # All - merged
  print(f"Conversion Merging All completed")
except TypeError:
  print(f"Failed to convert for Merging All")
