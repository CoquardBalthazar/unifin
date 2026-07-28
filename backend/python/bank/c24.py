import pandas as pd # type: ignore
import numpy as np # type: ignore


def csv_to_pdDf (file_path:str) -> pd.DataFrame:
  '''
  Reads a CSV file, converts data types, and reorders columns. Returns a pd.DataFrame, with the transactions from the C24 Bank.

  Parameters:
  file_path (str): Path to the CSV file.

  Returns:
  df : pd.DataFrame
    Processed DataFrame with correct types and reordered columns.

  Example:
  --------
  >>> file_path = "your_file.csv"
  >>> df = csv_to_pdDf(file_path)
  >>> print(df.dtypes)

  Notes:
  ------
  - 
  - 
  - 
  '''
  # Read the CSV file #############################################
  df = pd.read_csv(file_path, delimiter=",", dtype=str, parse_dates=["Buchungsdatum"], dayfirst=True)


  # Convert to correct datatypes ##############################################
  ## Convert 'Betrag' to float (replace German comma with dot) -----------------
  df["Betrag"] = df["Betrag"].str.replace(",", ".").astype(float)

  ## Convert 'Date' -------------------------------------------------------------
  ### Convert 'Buchungsdatum' column to numeric, invalid parsing will be set as NaN
  df['Buchungsdatum'] = pd.to_numeric(df['Buchungsdatum'], errors='coerce')

  ### Check if there are any invalid conversions (NaN values)
  print('Number of Invalid Date coonversion to numeric (step before conversion to datetime64) : ')
  print(df[df['Buchungsdatum'].isna()])  # This will show rows where the conversion failed

  ### Convert 'Buchungsdatum' from Nanoseconds Timestamp to datetime64
  df['Buchungsdatum'] = pd.to_datetime(df['Buchungsdatum'] / 1e9, unit='s')



  # Rename Amount, Date ######################################################
  df = df.rename(columns={"Buchungsdatum" : "Date", 'Betrag' : 'Amount'})
  print(df.columns)


  # Create 'Name' and 'Bank' column ##################################################
  ## Create the 'Name' column as 'Zahlungsempfänger' + 'Verwendungszweck'
  df['Name'] = df['Zahlungsempfänger'].fillna('') + ("_" + df['Verwendungszweck'].fillna(''))

  ## If both are NaN, just use 'Zahlungsempfänger' (default column)
  df['Name'] = df['Name'].str.rstrip("_")

  print(df.columns)

  ## Create column "Bank"
  df['Bank'] = "C24 Bank"


  # Define the desired column order #################################
  column_order = [
      "Bank", "Date", "Name", "Amount", "Zahlungsempfänger", "Verwendungszweck", "IBAN", "BIC", "Beschreibung", "Kategorie", "Unterkategorie", "Transaktionstyp"
  ]
  
  ## Reorder the DataFrame columns
  df = df[column_order]

  return df

