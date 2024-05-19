import { t, Trans } from '@lingui/macro'
import { ChainId, Currency } from '@vnaysn/jediswap-sdk-core'
import { useAccountDetails } from 'hooks/starknet-react'
import { ReactNode, useCallback, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowUpCircle, CheckCircle } from 'react-feather'
import styled, { useTheme } from 'styled-components'

import Badge from 'components/Badge'
import { ChainLogo } from 'components/Logo/ChainLogo'
import { getChainInfo } from 'constants/chainInfo'
import useCurrencyLogoURIs from 'lib/hooks/useCurrencyLogoURIs'
import { useIsTransactionConfirmed, useTransaction } from 'state/transactions/hooks'
import { ExternalLink, ThemedText, CloseIcon, CustomLightSpinner } from 'theme/components'
import { isL2ChainId } from 'utils/chains'
import { ExplorerDataType, getExplorerLink } from 'utils/getExplorerLink'
import Circle from '../../assets/images/blue-loader.svg'
import { TransactionSummary } from '../AccountDetails/TransactionSummary'
import { ButtonLight, ButtonPrimary } from '../Button'
import { AutoColumn, ColumnCenter } from '../Column'
import Modal from '../Modal'
import Row, { RowBetween, RowFixed } from '../Row'
import AnimatedConfirmation from './AnimatedConfirmation'
import { colors } from 'theme/colors'

const Wrapper = styled.div`
  background-color: ${({ theme }) => theme.surface1};
  border-radius: 8px;
  outline: 1px solid ${({ theme }) => theme.surface3};
  width: 100%;
  padding: 32px;
`

const BottomSection = styled(AutoColumn)`
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
`

const ConfirmedIcon = styled(ColumnCenter)<{ inline?: boolean }>`
  padding: ${({ inline }) => (inline ? '20px 0' : '32px 0;')};
`

const ConfirmationModalContentWrapper = styled(AutoColumn)`
  padding-bottom: 12px;
`

export function TransactionErrorContent({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Wrapper>
      <AutoColumn gap="md">
        <RowBetween>
          <ThemedText.SubHeaderLarge textAlign="center"> Error</ThemedText.SubHeaderLarge>
          <CloseIcon onClick={onDismiss} />
        </RowBetween>
        <AutoColumn style={{ marginTop: 20, padding: '2rem 0' }} gap="24px" justify="center">
          <AlertTriangle color={colors.red100} style={{ strokeWidth: 1.5 }} size={64} />
          <ThemedText.BodySecondary textAlign="center">{message}</ThemedText.BodySecondary>
        </AutoColumn>
      </AutoColumn>
      <BottomSection gap="12px">
        <ButtonPrimary onClick={onDismiss}>Dismiss</ButtonPrimary>
      </BottomSection>
    </Wrapper>
  )
}

function ConfirmationPendingContent({
  onDismiss,
  pendingText,
  inline,
}: {
  onDismiss: () => void
  pendingText: ReactNode
  inline?: boolean // not in modal
}) {
  return (
    <Wrapper>
      <AutoColumn gap="md">
        {!inline && (
          <RowBetween>
            <div />
            <CloseIcon onClick={onDismiss} />
          </RowBetween>
        )}
        <ConfirmedIcon inline={inline}>
          <CustomLightSpinner src={Circle} alt="loader" size={inline ? '40px' : '90px'} />
        </ConfirmedIcon>
        <AutoColumn gap="md" justify="center">
          <ThemedText.SubHeaderLarge color="neutral1" textAlign="center">
            <Trans>Waiting for confirmation</Trans>
          </ThemedText.SubHeaderLarge>
          <ThemedText.SubHeader color="neutral1" textAlign="center">
            {pendingText}
          </ThemedText.SubHeader>
          <ThemedText.SubHeaderSmall color="neutral2" textAlign="center" marginBottom="12px">
            <Trans>Confirm this transaction in your wallet</Trans>
          </ThemedText.SubHeaderSmall>
        </AutoColumn>
      </AutoColumn>
    </Wrapper>
  )
}
function TransactionSubmittedContent({
  onDismiss,
  chainId,
  hash,
  currencyToAdd,
  inline,
}: {
  onDismiss: () => void
  hash?: string
  chainId: string
  currencyToAdd?: Currency
  inline?: boolean // not in modal
}) {
  const theme = useTheme()
  const explorerText = chainId === ChainId.MAINNET ? t`View on  Starkscan` : t`View on Block Explorer`

  return (
    <Wrapper>
      <AutoColumn>
        {!inline && (
          <RowBetween>
            <div />
            <CloseIcon onClick={onDismiss} />
          </RowBetween>
        )}
        <ConfirmedIcon inline={inline}>
          <ArrowUpCircle strokeWidth={1} size={inline ? '40px' : '75px'} color={theme.accent1} />
        </ConfirmedIcon>
        <ConfirmationModalContentWrapper gap="md" justify="center">
          <ThemedText.MediumHeader textAlign="center">
            <Trans>Transaction submitted</Trans>
          </ThemedText.MediumHeader>
          {/* {currencyToAdd && connector.watchAsset && (
            <ButtonLight mt="12px" padding="6px 12px" width="fit-content" onClick={addToken}>
              {!success ? (
                <RowFixed>
                  <Trans>Add {currencyToAdd.symbol}</Trans>
                </RowFixed>
              ) : (
                <RowFixed>
                  <Trans>Added {currencyToAdd.symbol} </Trans>
                  <CheckCircle size="16px" stroke={theme.success} style={{ marginLeft: '6px' }} />
                </RowFixed>
              )}
            </ButtonLight>
          )} */}
          <ButtonPrimary onClick={onDismiss} style={{ margin: '20px 0 0 0' }} data-testid="dismiss-tx-confirmation">
            <ThemedText.HeadlineSmall color={theme.deprecated_accentTextLightPrimary}>
              {inline ? <Trans>Return</Trans> : <Trans>Close</Trans>}
            </ThemedText.HeadlineSmall>
          </ButtonPrimary>
          {chainId && hash && (
            <ExternalLink href={getExplorerLink(chainId, hash, ExplorerDataType.TRANSACTION)}>
              <ThemedText.Link color={theme.accent1}>{explorerText}</ThemedText.Link>
            </ExternalLink>
          )}
        </ConfirmationModalContentWrapper>
      </AutoColumn>
    </Wrapper>
  )
}

export function ConfirmationModalContent({
  title,
  bottomContent,
  onDismiss,
  topContent,
  headerContent,
}: {
  title: ReactNode
  onDismiss: () => void
  topContent: () => ReactNode
  bottomContent?: () => ReactNode
  headerContent?: () => ReactNode
}) {
  return (
    <Wrapper>
      <AutoColumn gap="sm">
        <Row>
          {headerContent?.()}
          <Row>
            <ThemedText.SubHeader>{title}</ThemedText.SubHeader>
          </Row>
          <CloseIcon onClick={onDismiss} data-testid="confirmation-close-icon" />
        </Row>
        {topContent()}
      </AutoColumn>
      {bottomContent && <BottomSection gap="16px">{bottomContent()}</BottomSection>}
    </Wrapper>
  )
}

const StyledL2Badge = styled(Badge)`
  padding: 6px 8px;
`

function L2Content({
  onDismiss,
  chainId,
  hash,
  pendingText,
  inline,
}: {
  onDismiss: () => void
  hash?: string
  chainId: ChainId
  currencyToAdd?: Currency
  pendingText: ReactNode
  inline?: boolean // not in modal
}) {
  const theme = useTheme()

  const transaction = useTransaction(hash)
  const confirmed = useIsTransactionConfirmed(hash)
  const transactionSuccess = transaction?.receipt?.status === 1

  // convert unix time difference to seconds
  const secondsToConfirm = transaction?.confirmedTime
    ? (transaction.confirmedTime - transaction.addedTime) / 1000
    : undefined

  const info = getChainInfo(chainId)

  return (
    <Wrapper>
      <AutoColumn>
        {!inline && (
          <RowBetween mb="16px">
            <StyledL2Badge>
              <RowFixed gap="sm">
                <ChainLogo chainId={chainId} />
                <ThemedText.SubHeaderSmall>{info.label}</ThemedText.SubHeaderSmall>
              </RowFixed>
            </StyledL2Badge>
            <CloseIcon onClick={onDismiss} />
          </RowBetween>
        )}
        <ConfirmedIcon inline={inline}>
          {confirmed ? (
            transactionSuccess ? (
              // <CheckCircle strokeWidth={1} size={inline ? '40px' : '90px'} color={theme.success} />
              <AnimatedConfirmation />
            ) : (
              <AlertCircle strokeWidth={1} size={inline ? '40px' : '90px'} color={theme.critical} />
            )
          ) : (
            <CustomLightSpinner src={Circle} alt="loader" size={inline ? '40px' : '90px'} />
          )}
        </ConfirmedIcon>
        <AutoColumn gap="md" justify="center">
          <ThemedText.SubHeaderLarge textAlign="center">
            {!hash ? (
              <Trans>Confirm transaction in wallet</Trans>
            ) : !confirmed ? (
              <Trans>Transaction submitted</Trans>
            ) : transactionSuccess ? (
              <Trans>Success</Trans>
            ) : (
              <Trans>Error</Trans>
            )}
          </ThemedText.SubHeaderLarge>
          <ThemedText.BodySecondary textAlign="center">
            {transaction ? <TransactionSummary info={transaction.info} /> : pendingText}
          </ThemedText.BodySecondary>
          {chainId && hash ? (
            <ExternalLink href={getExplorerLink(chainId, hash, ExplorerDataType.TRANSACTION)}>
              <ThemedText.SubHeaderSmall color={theme.accent1}>
                <Trans>View on Explorer</Trans>
              </ThemedText.SubHeaderSmall>
            </ExternalLink>
          ) : (
            <div style={{ height: '17px' }} />
          )}
          <ThemedText.SubHeaderSmall color={theme.neutral3} marginTop="20px">
            {!secondsToConfirm ? (
              <div style={{ height: '24px' }} />
            ) : (
              <div>
                <Trans>Transaction completed in </Trans>
                <span style={{ fontWeight: 535, marginLeft: '4px', color: theme.neutral1 }}>
                  {secondsToConfirm} seconds 🎉
                </span>
              </div>
            )}
          </ThemedText.SubHeaderSmall>
          <ButtonPrimary onClick={onDismiss} style={{ margin: '4px 0 0 0' }}>
            <ThemedText.SubHeaderLarge>
              {inline ? <Trans>Return</Trans> : <Trans>Close</Trans>}
            </ThemedText.SubHeaderLarge>
          </ButtonPrimary>
        </AutoColumn>
      </AutoColumn>
    </Wrapper>
  )
}

interface ConfirmationModalProps {
  isOpen: boolean
  onDismiss: () => void
  hash?: string
  reviewContent: () => ReactNode
  attemptingTxn: boolean
  pendingText: ReactNode
  currencyToAdd?: Currency
}

export default function TransactionConfirmationModal({
  isOpen,
  onDismiss,
  attemptingTxn,
  hash,
  pendingText,
  reviewContent,
  currencyToAdd,
}: ConfirmationModalProps) {
  const { chainId } = useAccountDetails()

  if (!chainId) {
    return null
  }

  // confirmation screen
  return (
    <Modal isOpen={isOpen} $scrollOverlay onDismiss={onDismiss} maxHeight={90}>
      {isL2ChainId(chainId) && (hash || attemptingTxn) ? (
        <L2Content chainId={chainId} hash={hash} onDismiss={onDismiss} pendingText={pendingText} />
      ) : attemptingTxn ? (
        <ConfirmationPendingContent onDismiss={onDismiss} pendingText={pendingText} />
      ) : hash ? (
        <TransactionSubmittedContent
          chainId={chainId}
          hash={hash}
          onDismiss={onDismiss}
          currencyToAdd={currencyToAdd}
        />
      ) : (
        reviewContent()
      )}
    </Modal>
  )
}
