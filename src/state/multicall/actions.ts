import { FunctionAbi, Calldata } from 'starknet'
import { createAction } from '@reduxjs/toolkit'
import { isAddressValidForERC20 } from '../../utils'
import { ChainId } from '@vnaysn/jediswap-sdk-core'
import { isAddressValid } from 'utils/addresses'

export interface Call {
  address: string
  methodName: string
  calldata_len: string
  calldata: Calldata
  // contractInterface?: Abi[]
}

export function callDataToString(data: Calldata): string {
  return data.length > 0 ? `-${data.join('-')}` : ''
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{1,63}$/
const LOWER_HEX_REGEX = /^0x[a-f0-9]*$/
export function toCallKey(call: Call): string {
  if (!isAddressValid(call.address)) {
    throw new Error(`Invalid address: ${call.address}`)
  }
  //   if (!LOWER_HEX_REGEX.test(call.calldata)) {
  //     throw new Error(`Invalid hex: ${call.callData}`)
  //   }

  const key = `${call.address}-${call.methodName}-${call.calldata_len}${callDataToString(call.calldata)}`

  // if (call.calldata) {
  return key
  // }

  // return `${call.address}-${call.selector}-${call.calldata_len}`
}

// total length = 5
// 0 -> address, 1 -> selector, 2 -> len, 3 -> calldata1, 4 -> calldata2

export function parseCallKey(callKey: string): Call {
  const pcs = callKey.split('-')
  if (pcs.length < 3) {
    throw new Error(`Invalid call key: ${callKey}`)
  }
  return {
    address: pcs[0],
    methodName: pcs[1],
    calldata_len: pcs[2],
    calldata: pcs.slice(3),
  }
}

export interface ListenerOptions {
  // how often this data should be fetched, by default 1
  readonly blocksPerFetch?: number
}

export const addMulticallListeners = createAction<{
  chainId: ChainId
  calls: Call[]
  methodAbi: FunctionAbi | undefined
  options?: ListenerOptions
}>('starkmulticall/addMulticallListeners')
export const removeMulticallListeners = createAction<{
  chainId: ChainId
  calls: Call[]
  options?: ListenerOptions
}>('starkmulticall/removeMulticallListeners')
export const fetchingMulticallResults = createAction<{
  chainId: ChainId
  calls: Call[]
  fetchingBlockNumber: number
}>('starkmulticall/fetchingMulticallResults')
export const errorFetchingMulticallResults = createAction<{
  chainId: ChainId
  calls: Call[]
  fetchingBlockNumber: number
}>('starkmulticall/errorFetchingMulticallResults')
export const updateMulticallResults = createAction<{
  chainId: ChainId
  blockNumber: number
  results: {
    [callKey: string]: string | null
  }
}>('starkmulticall/updateMulticallResults')
