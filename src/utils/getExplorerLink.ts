import { ChainId } from '@vnaysn/jediswap-sdk-core'

const BLOCK_EXPLORER_PREFIXES: { [chainId: string]: string } = {
  [ChainId.MAINNET]: 'https://starkscan.co',
  [ChainId.GOERLI]: 'https://sepolia.starkscan.co',
}

export enum ExplorerDataType {
  TRANSACTION = 'transaction',
  TOKEN = 'token',
  ADDRESS = 'address',
  BLOCK = 'block',
  NATIVE = 'native',
}

/**
 * Return the explorer link for the given data and data type
 * @param chainId the ID of the chain for which to return the data
 * @param data the data to return a link for
 * @param type the type of the data
 */
export function getExplorerLink(chainId: string, data: string, type: ExplorerDataType): string {
  const prefix = BLOCK_EXPLORER_PREFIXES[chainId]

  switch (type) {
    case ExplorerDataType.TRANSACTION:
      return `${prefix}/tx/${data}`

    case ExplorerDataType.TOKEN:
      return `${prefix}/token/${data}`

    case ExplorerDataType.BLOCK:
      return `${prefix}/block/${data}`

    case ExplorerDataType.ADDRESS:
      return `${prefix}/address/${data}`
    default:
      return `${prefix}`
  }
}
