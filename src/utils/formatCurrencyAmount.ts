import { Currency, CurrencyAmount, Fraction } from '@vnaysn/jediswap-sdk-core'
import { DEFAULT_LOCALE, SupportedLocale } from 'constants/locales'
import JSBI from 'jsbi'
import formatLocaleNumber from 'lib/utils/formatLocaleNumber'

export function formatCurrencyAmount(
  amount: CurrencyAmount<Currency> | undefined,
  sigFigs: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
  fixedDecimals?: number
): string {
  if (!amount) {
    return '-'
  }

  if (JSBI.equal(amount.quotient, JSBI.BigInt(0))) {
    return '0'
  }

  return formatLocaleNumber({ number: amount, locale, sigFigs, fixedDecimals })
}
