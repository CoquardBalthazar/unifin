import c24 as c24
import bp as bp
import pandas as pd # type: ignore

'''
README
File contains :
- merge_transactions()
- write_to_csv()
'''





def merge_transactions (transactions_to_merge : list) -> pd.DataFrame:
  '''
  Take a list of pandas.DataFrames with bank transactions as input. Merge them and return a new pd.Df.
  CAREFUL : 
    transactions_to_merge[0] = LaBanquePostale_transactions
    transactions_to_merge[1] = C24_transactions
    transactions_to_merge[...] = other_banks

  Parameters:
  transactions_to_merge : list
    List of pd.DataFrames containing the transactions for each banks.

  Returns:
  df : pd.DataFrame
    Processed DataFrame with columns {"Bank":str, "Date":datetime64, "Name":str, "Amount":float}

  Example:
  --------
  >>> 

  Notes:
  ------
  '''
  bp_transactions = transactions_to_merge[0] # Transactions from La Banque Postale
  c24_transactions = transactions_to_merge[1] # Transactions from C24 Bank

  df_combined = pd.concat(
    [bp_transactions, c24_transactions], 
    ignore_index=True, 
    sort=False)

  return df_combined






def write_to_csv(pdDf_input : pd.DataFrame, output_csv_filepath : str):
  pdDf_input.to_csv(output_csv_filepath, index=False, header=True, sep=',', encoding='utf-8')
      