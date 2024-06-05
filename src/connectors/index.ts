import { WebWalletConnector } from '@argent/starknet-react-webwallet-connector'
import { InjectedConnector } from '@starknet-react/core'

export const NETWORK_CHAIN_ID: number = parseInt(process.env.REACT_APP_CHAIN_ID ?? '5')

export const isProductionEnvironment = () => {
  if (!window.location) {
    return false
  }
  if (String(window.location) === '//') {
    return false
  }
  const host = new URL(String(window.location))?.host || ''
  return host === 'app.jediswap.xyz'
}

export const isTestnetEnvironment = () => {
  if (!location) {
    return false
  }
  if (String(location) === '//') {
    return false
  }
  const host = new URL(String(location))?.host || ''
  return host === 'app.v2.goerli.jediswap.xyz'
}

export const isLocalEnvironment = () => {
  if (!location) {
    return false
  }
  if (String(location) === '//') {
    return false
  }
  const hostname = new URL(String(location))?.hostname || ''
  return hostname === 'localhost'
}

export const isStagingEnvironment = () => {
  if (!location) {
    return false
  }
  if (String(location) === '//') {
    return false
  }
  const host = new URL(String(location))?.host || ''
  return host === 'app.v2.staging.jediswap.xyz'
}

export const webWalletUrl = isTestnetEnvironment() ? 'https://web.hydrogen.argent47.net/' : 'https://web.argent.xyz/'

export const argentX = new InjectedConnector({ options: { id: 'argentX' } })
export const braavosWallet = new InjectedConnector({ options: { id: 'braavos' } })
export const argentWebWallet = new WebWalletConnector({
  url: webWalletUrl,
})

export type injectedConnector = 'argentX' | 'braavos'
