import csv
import pandas as pd # type: ignore

def tsv_to_pdDf(file_path : str ) -> pd.DataFrame:
  '''
  Reads a CSV file, converts data types, and reorders columns. Returns a pd.DataFrame, with the transactions from the BanquePostale Bank.

  Parameters:
  file_path (str): Path to the TSV file.

  Returns:
  df : pd.DataFrame
    Processed DataFrame with correct types and reordered columns.

  Example:
  --------
  >>> file_path = 'data/tsv/20241204-90j-November_2143295S0381733329609711.tsv'
  >>> tsv_to_pdDf(file_path = file_path)

  Notes:
  ------

  '''

  # Define Column names : 
  column_names = ['Date', 'Name', 'Amount']

  # Read TSV file with tab delimiter (TSV). Skip first rows (Summary Data) + Empty row to get directly to columns names
  df = pd.read_csv(
    file_path,
    delimiter="\t",        # Tab-separated values
    skiprows=7,            # Skip summary data (first 7 lines)
    skip_blank_lines=True, # Ignore empty lines
    names=column_names,    # Assign custom column names
    header=None,           # File has no headers, use `names`
    dtype=str,             # Read all columns as strings first
    parse_dates=["Date"],  # Convert "Date" column to datetime format
    dayfirst=True,          # Dates are in "DD/MM/YYYY" format
    encoding="ISO-8859-1"  # Try a different encoding if UTF-8 doesn't work
)
  # Convert to correct datatypes ##############################################
  ## Convert "Amount" to float (replace comma with dot for decimals) -----------
  df["Amount"] = df["Amount"].str.replace(",", ".").astype(float)


  ## Convert 'Date' -------------------------------------------------------------
  ### Convert 'Buchungsdatum' column to numeric, invalid parsing will be set as NaN
  df['Date'] = pd.to_numeric(df['Date'], errors='coerce')

  ### Check if there are any invalid conversions (NaN values)
  print('Number of Invalid Date coonversion to numeric (step before conversion to datetime64) : ')
  print(df[df['Date'].isna()])  # This will show rows where the conversion failed

  ### Convert 'Buchungsdatum' from Nanoseconds Timestamp to datetime64
  df['Date'] = pd.to_datetime(df['Date'] / 1e9, unit='s')


  # Add column "Bank"
  df['Bank'] = "La Banque Postale"

    # Define the desired column order #################################
  column_order = [
      "Bank", "Date", "Name", "Amount"
  ]
  
  ## Reorder the DataFrame columns
  df = df[column_order]


  return df