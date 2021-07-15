import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react'
import {CurrentBridgeInfo, createAddress} from 'anyswapsdk'
import { useTranslation } from 'react-i18next'
import styled, { ThemeContext } from 'styled-components'
import { ArrowDown } from 'react-feather'

import SelectChainIdInputPanel from '../CrossChain/selectChainID'
import Reminder from '../CrossChain/reminder'

import { useActiveWeb3React } from '../../hooks'
import {useCrossBridgeCallback} from '../../hooks/useBridgeCallback'
import { WrapType } from '../../hooks/useWrapCallback'
import { useApproveCallback, ApprovalState } from '../../hooks/useApproveCallback'
import { useLocalToken } from '../../hooks/Tokens'

import SelectCurrencyInputPanel from '../../components/CurrencySelect/selectCurrency'
import { AutoColumn } from '../../components/Column'
import { ButtonLight, ButtonPrimary, ButtonConfirmed } from '../../components/Button'
import { AutoRow } from '../../components/Row'
import Loader from '../../components/Loader'
import AddressInputPanel from '../../components/AddressInputPanel'
import { ArrowWrapper, BottomGrouping } from '../../components/swap/styleds'
import Title from '../../components/Title'
import ModalContent from '../../components/Modal/ModalContent'
import {selectNetwork} from '../../components/Header/SelectNetwork'
import QRcode from '../../components/QRcode'

// import { useWalletModalToggle, useToggleNetworkModal } from '../../state/application/hooks'
import { useWalletModalToggle } from '../../state/application/hooks'
import { tryParseAmount } from '../../state/swap/hooks'

import config from '../../config'
import {getParams} from '../../config/getUrlParams'

// import {getTokenConfig} from '../../utils/bridge/getBaseInfo'
// import {getTokenConfig} from '../../utils/bridge/getServerInfo'
import {getNodeTotalsupply} from '../../utils/bridge/getBalance'
import {formatDecimal} from '../../utils/tools/tools'
import { isAddress } from '../../utils'

import AppBody from '../AppBody'
import TokenLogo from '../../components/TokenLogo'

const LiquidityView = styled.div`
  ${({theme}) => theme.flexSC};
  border: solid 0.5px ${({ theme }) => theme.tipBorder};
  background-color: ${({ theme }) => theme.tipBg};
  border-radius: 0.5625rem;
  padding: 8px 16px;
  color: ${({ theme }) => theme.tipColor};
  font-size: 12px;
  white-space:nowrap;
  .item {
    ${({theme}) => theme.flexBC};
    margin-right: 10px;
    margin-left: 10px;
    .cont {
      margin-left: 10px;
      color: ${({ theme }) => theme.tipColor};
      font-size: 12px;
    }
  }
  ${({ theme }) => theme.mediaWidth.upToLarge`
    padding: 8px 12px;
  `};
`

const LogoBox = styled.div`
  ${({ theme }) => theme.flexC};
  width: 46px;
  height: 46px;
  object-fit: contain;
  box-shadow: 0 0.125rem 0.25rem 0 rgba(0, 0, 0, 0.04);
  border: solid 0.5px rgba(0, 0, 0, 0.1);
  border-radius:100%;
  margin: auto;

  img{
    height: 24px;
    width: 24px;
    display:block;
  }
`
const ConfirmContent = styled.div`
  width: 100%;
`
const TxnsInfoText = styled.div`
  font-family: 'Manrope';
  font-size: 22px;
  text-align: center;
  color: ${({ theme }) => theme.textColorBold};
  margin-top: 1rem;
`
const ConfirmText = styled.div`
  width: 100%;
  font-family: 'Manrope';
  font-size: 0.75rem;
  font-weight: bold;
  text-align: center;
  color: #734be2;
  padding: 1.25rem 0;
  border-top: 0.0625rem solid rgba(0, 0, 0, 0.08);
  margin-top:1.25rem
`

const ListBox = styled.div`
  width:100%;
  margin-bottom: 30px;
  .item{
    width: 100%;
    margin-bottom: 10px;
    .label{
      color: ${({ theme }) => theme.text1};
      margin: 0;
    }
    .value {
      color: ${({ theme }) => theme.textColorBold};
      margin: 0;
    }
  }
`

let intervalFN:any = ''

export enum BridgeType {
  deposit = 'deposit',
  swapin = 'swapin',
  swapout = 'swapout',
}

export default function CrossChain() {
  // const { account, chainId, library } = useActiveWeb3React()
  const { account, chainId } = useActiveWeb3React()
  const { t } = useTranslation()
  // const toggleNetworkModal = useToggleNetworkModal()
  // const history = createBrowserHistory()
  const theme = useContext(ThemeContext)
  const toggleWalletModal = useWalletModalToggle()

  const [inputBridgeValue, setInputBridgeValue] = useState('')
  const [selectCurrency, setSelectCurrency] = useState<any>()
  const [selectChain, setSelectChain] = useState<any>()
  const [selectChainList, setSelectChainList] = useState<Array<any>>([])
  const [recipient, setRecipient] = useState<any>(account ?? '')
  const [swapType, setSwapType] = useState(BridgeType.deposit)
  const [count, setCount] = useState<number>(0)
  const [intervalCount, setIntervalCount] = useState<number>(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipOpen, setModalTipOpen] = useState(false)
  const [modalSpecOpen, setModalSpecOpen] = useState(false)

  // const [bridgeConfig, setBridgeConfig] = useState<any>()

  const [approvalSubmitted, setApprovalSubmitted] = useState<boolean>(false)

  const [delayAction, setDelayAction] = useState<boolean>(false)

  const [allTokens, setAllTokens] = useState<any>({})

  const [curChain, setCurChain] = useState<any>({
    chain: chainId,
    ts: '',
    bl: ''
  })
  const [destChain, setDestChain] = useState<any>({
    chain: config.getCurChainInfo(chainId).bridgeInitChain,
    ts: '',
    bl: ''
  })

  let initBridgeToken:any = getParams('bridgetoken') ? getParams('bridgetoken') : ''
  initBridgeToken = initBridgeToken && isAddress(initBridgeToken) ? initBridgeToken.toLowerCase() : ''
  // console.log(selectCurrency)

  const formatCurrency = useLocalToken(
    selectCurrency?.underlying ? {
      ...selectCurrency,
      address: selectCurrency.underlying.address,
      name: selectCurrency.underlying.name,
      symbol: selectCurrency.underlying?.symbol,
      decimals: selectCurrency.underlying.decimals
    } : selectCurrency)
  // const formatInputBridgeValue = inputBridgeValue && Number(inputBridgeValue) ? tryParseAmount(inputBridgeValue, formatCurrency ?? undefined) : ''
  const formatInputBridgeValue = tryParseAmount(inputBridgeValue, formatCurrency ?? undefined)
  const [approval, approveCallback] = useApproveCallback(formatInputBridgeValue ?? undefined, config.getCurChainInfo(chainId).bridgeRouterToken)

  useEffect(() => {
    if (approval === ApprovalState.PENDING) {
      setApprovalSubmitted(true)
    }
  }, [approval, approvalSubmitted])

  // console.log(selectCurrency)

  function onDelay () {
    setDelayAction(true)
  }
  function onClear () {
    setDelayAction(false)
    setModalTipOpen(false)
    setModalSpecOpen(false)
    setInputBridgeValue('')
  }

  function changeNetwork (chainID:any) {
    selectNetwork(chainID).then((res: any) => {
      console.log(res)
      if (res.msg === 'Error') {
        alert(t('changeMetamaskNetwork', {label: config.getCurChainInfo(chainID).networkName}))
      }
    })
  }

  const getSelectPool = useCallback(async() => {
    if (selectCurrency && chainId) {
      const CC:any = await getNodeTotalsupply(
        selectCurrency?.address,
        chainId,
        selectCurrency?.decimals,
        account,
        selectCurrency?.underlying?.address
      )
      // console.log(CC)
      // console.log(selectCurrency)
      if (CC) {
        setCurChain({
          chain: chainId,
          ts: selectCurrency?.underlying ? CC[selectCurrency?.address]?.ts : CC[selectCurrency?.address]?.anyts,
          bl: CC[selectCurrency?.address]?.balance
        })
      }
      if (!isNaN(selectChain)) {
        const DC:any = await getNodeTotalsupply(
          selectCurrency?.destChains[selectChain]?.address,
          selectChain,
          selectCurrency?.destChains[selectChain]?.decimals,
          account,
          selectCurrency?.destChains[selectChain]?.underlying?.address
        )
        if (DC) {
          setDestChain({
            chain: selectChain,
            ts: selectCurrency?.underlying ? DC[selectCurrency?.destChains[selectChain].address]?.ts : DC[selectCurrency?.destChains[selectChain].token]?.anyts,
            bl: DC[selectCurrency?.destChains[selectChain].address]?.balance
          })
        }
      }
      // console.log(CC)
      // console.log(DC)
      if (intervalFN) clearTimeout(intervalFN)
      intervalFN = setTimeout(() => {
        setIntervalCount(intervalCount + 1)
      }, 1000 * 10)
    }
  }, [selectCurrency, chainId, account, selectChain, intervalCount])


  useEffect(() => {
    getSelectPool()
  }, [getSelectPool])

  const bridgeConfig = useMemo(() => {
    // console.log(allTokens)
    if (selectCurrency?.address && allTokens[selectCurrency?.address]) return allTokens[selectCurrency?.address]
    return ''
  }, [selectCurrency, allTokens])

  const destConfig = useMemo(() => {
    if (bridgeConfig && bridgeConfig?.destChains[selectChain]) {
      return bridgeConfig?.destChains[selectChain]
    }
    return false
  }, [bridgeConfig, selectChain])
  
  const { wrapType, execute: onWrap, inputError: wrapInputError } = useCrossBridgeCallback(
    formatCurrency ? formatCurrency : undefined,
    swapType === BridgeType.swapin ? destConfig.DepositAddress : recipient,
    inputBridgeValue,
    selectChain,
    swapType,
    selectCurrency?.address,
    selectCurrency?.pairid
  )
  // console.log(selectCurrency)
  const isNativeToken = useMemo(() => {
    if (
      selectCurrency
      && chainId
      && config.getCurChainInfo(chainId)
      && config.getCurChainInfo(chainId).symbol.toLowerCase() === selectCurrency.symbol.toLowerCase()
    ) {
      return true
    }
    return false
  }, [selectCurrency, chainId])
  // console.log(isNativeToken)
  const isUnderlying = useMemo(() => {
    if (selectCurrency && selectCurrency?.underlying) {
      return true
    }
    return false
  }, [selectCurrency, selectChain])

  
  const isDestUnderlying = useMemo(() => {
    if (selectCurrency && selectCurrency?.destChains[selectChain]?.underlying) {
      return true
    }
    return false
  }, [selectCurrency, selectChain])

  const outputBridgeValue = useMemo(() => {
    if (inputBridgeValue && destConfig) {
      const fee = Number(inputBridgeValue) * Number(destConfig.SwapFeeRatePerMillion) / 100
      let value = Number(inputBridgeValue) - fee
      if (fee < Number(destConfig.MinimumSwapFee)) {
        value = Number(inputBridgeValue) - Number(destConfig.MinimumSwapFee)
      } else if (fee > destConfig.MaximumSwapFee) {
        value = Number(inputBridgeValue) - Number(destConfig.MaximumSwapFee)
      }
      if (value && Number(value) && Number(value) > 0) {
        return formatDecimal(value, Math.min(6, selectCurrency.decimals))
      }
      return ''
    } else {
      return ''
    }
  }, [inputBridgeValue, destConfig])

  const isWrapInputError = useMemo(() => {
    if (wrapInputError) {
      return wrapInputError
    } else {
      return false
    }
  }, [wrapInputError, selectCurrency])

  const isCrossBridge = useMemo(() => {
    if (
      account
      && destConfig
      && selectCurrency
      && inputBridgeValue
      && (
        (!isWrapInputError && swapType !== BridgeType.deposit)
        || (isWrapInputError && swapType === BridgeType.deposit)
      )
      && isAddress(recipient)
      && destChain
    ) {
      if (
        Number(inputBridgeValue) < Number(destConfig.MinimumSwap)
        || Number(inputBridgeValue) > Number(destConfig.MaximumSwap)
        || (isDestUnderlying && Number(inputBridgeValue) > Number(destChain.ts))
      ) {
        return true
      } else {
        return false
      }
    } else {
      return true
    }
  }, [selectCurrency, account, destConfig, inputBridgeValue, recipient, destChain, isWrapInputError])

  const isInputError = useMemo(() => {
    // console.log(isCrossBridge)
    if (
      account
      && destConfig
      && selectCurrency
      && inputBridgeValue
      && isCrossBridge
    ) {
      if (
        Number(inputBridgeValue) < Number(destConfig.MinimumSwap)
        || Number(inputBridgeValue) > Number(destConfig.MaximumSwap)
        || (isDestUnderlying && Number(inputBridgeValue) > Number(destChain.ts))
        || isCrossBridge
      ) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }, [account, destConfig, selectCurrency, inputBridgeValue, isCrossBridge])


  const btnTxt = useMemo(() => {
    // console.log(isWrapInputError)
    if (isWrapInputError && inputBridgeValue && swapType !== BridgeType.deposit) {
      return isWrapInputError
    } else if (
      destConfig
      && inputBridgeValue
      && (
        Number(inputBridgeValue) < Number(destConfig.MinimumSwap)
        || Number(inputBridgeValue) > Number(destConfig.MaximumSwap)
      )
    ) {
      return t('ExceedLimit')
    } else if (isDestUnderlying && Number(inputBridgeValue) > Number(destChain.ts)) {
      return t('nodestlr')
    } else if (wrapType === WrapType.WRAP) {
      return t('swap')
    }
    return t('swap')
  }, [t, isWrapInputError, inputBridgeValue, swapType])

  const p2pAddress = useMemo(() => {
    if (account && selectCurrency && destConfig && swapType === BridgeType.deposit) {
      return createAddress(account, selectCurrency?.symbol, destConfig?.DepositAddress)
    }
    return ''
  }, [account, selectCurrency, destConfig])
  // console.log(p2pAddress)
  
  useEffect(() => {
    setSelectCurrency('')
    if (account) {
      setRecipient(account)
    }
  }, [account, swapType])

  useEffect(() => {
    const t = selectCurrency && selectCurrency.chainId === chainId ? selectCurrency.address : (initBridgeToken ? initBridgeToken : '')
    // console.log(swapType)
    setAllTokens({})
    if (chainId) {
      CurrentBridgeInfo(chainId).then((res:any) => {
        console.log(res)
        // console.log(swapType)
        if (res) {
          const list:any = {}
          let t1 = ''
          for (const token in res[swapType]) {
            // console.log(token)
            if (!isAddress(token) && token !== config.getCurChainInfo(chainId).symbol) continue
            const obj = res[swapType]
            list[token] = {
              ...obj[token],
              "address": token,
              "chainId": chainId,
              "decimals": obj[token].decimals,
              "name": obj[token].name,
              "symbol": obj[token].symbol,
              "underlying": obj[token].underlying,
              "destChains": obj[token].destChains,
              "logoUrl": obj[token].logoUrl,
              "pairid": obj[token].pairid,
            }
            if (!selectCurrency || selectCurrency?.chainId !== chainId) {
              // console.log(t)
              // console.log(token)
              if (t && t === token) {
                setSelectCurrency(list[token])
              } else if (!t && !t1) {
                t1 = token
                setSelectCurrency(list[t1])
              }
            }
          }
          // console.log(list)
          setAllTokens(list)
        } else {
          setTimeout(() => {
            setCount(count + 1)
          }, 1000)
          // setBridgeConfig('')
        }
      })
    } else {
      setAllTokens({})
    }
  }, [chainId, swapType, count, selectCurrency])

  // console.log(selectChain)
  useEffect(() => {
    if (selectCurrency) {
      const arr:any = []
      for (const c in selectCurrency?.destChains) {
        if (Number(c) === Number(chainId) && swapType !== BridgeType.deposit) continue
        arr.push(c)
      }
      // console.log(arr)
      if (arr.length > 0) {
        for (const c of arr) {
          if (config.getCurBridgeConfigInfo(chainId)?.hiddenChain?.includes(c)) continue
          setSelectChain(c)
          break
        }
      } else {
        setSelectChain(config.getCurChainInfo(chainId).bridgeInitChain)
      }
      setSelectChainList(arr)
    }
  }, [selectCurrency])

  const handleMaxInput = useCallback((value) => {
    if (value) {
      setInputBridgeValue(value)
    } else {
      setInputBridgeValue('')
    }
  }, [setInputBridgeValue])
  // console.log(isUnderlying)
  // console.log(selectChainList)
  return (
    <>
      <ModalContent
        isOpen={modalSpecOpen}
        title={'Cross-chain Router'}
        onDismiss={() => {
          setModalSpecOpen(false)
        }}
      >
        <ListBox>
          <div className="item">
            <p className="label">Value:</p>
            <p className="value">{inputBridgeValue}</p>
          </div>
          <div className="item">
            <p className="label">Address:</p>
            <p className="value">{p2pAddress}</p>
          </div>
          <div className="item">
            <QRcode uri={p2pAddress} size={160}></QRcode>
          </div>
        </ListBox>
        <BottomGrouping>
          <ButtonLight onClick={() => {
            setModalSpecOpen(false)
          }}>{t('Confirm')}</ButtonLight>
        </BottomGrouping>
      </ModalContent>
      <ModalContent
        isOpen={modalTipOpen}
        title={'Cross-chain Router'}
        onDismiss={() => {
          setModalTipOpen(false)
        }}
      >
        <LogoBox>
          <TokenLogo symbol={selectCurrency?.symbol} logoUrl={selectCurrency?.logoUrl} size={'1rem'}></TokenLogo>
        </LogoBox>
        <ConfirmContent>
          <TxnsInfoText>{inputBridgeValue + ' ' + config.getBaseCoin(selectCurrency?.underlying?.symbol ?? selectCurrency?.symbol, chainId)}</TxnsInfoText>
          {
            isUnderlying && isDestUnderlying ? (
              <ConfirmText>
                {
                  t('swapTip', {
                    symbol: config.getBaseCoin(selectCurrency?.symbol, chainId),
                    symbol1: config.getBaseCoin(selectCurrency?.underlying?.symbol ?? selectCurrency?.symbol, chainId),
                    chainName: config.getCurChainInfo(selectChain).name
                  })
                }
              </ConfirmText>
            ) : ''
          }
          <BottomGrouping>
            {!account ? (
                <ButtonLight onClick={toggleWalletModal}>{t('ConnectWallet')}</ButtonLight>
              ) : (
                !isNativeToken && selectCurrency && selectCurrency.underlying && inputBridgeValue && (approval === ApprovalState.NOT_APPROVED || approval === ApprovalState.PENDING)? (
                  <ButtonConfirmed
                    onClick={() => {
                      onDelay()
                      approveCallback().then(() => {
                        onClear()
                      })
                    }}
                    disabled={approval !== ApprovalState.NOT_APPROVED || approvalSubmitted || delayAction}
                    width="48%"
                    altDisabledStyle={approval === ApprovalState.PENDING} // show solid button while waiting
                    // confirmed={approval === ApprovalState.APPROVED}
                  >
                    {approval === ApprovalState.PENDING ? (
                      <AutoRow gap="6px" justify="center">
                        {t('Approving')} <Loader stroke="white" />
                      </AutoRow>
                    ) : approvalSubmitted ? (
                      t('Approved')
                    ) : (
                      t('Approve') + ' ' + config.getBaseCoin(selectCurrency?.underlying?.symbol ?? selectCurrency?.symbol, chainId)
                    )}
                  </ButtonConfirmed>
                ) : (
                  <ButtonPrimary disabled={isCrossBridge || delayAction} onClick={() => {
                  // <ButtonPrimary disabled={delayAction} onClick={() => {
                    onDelay()
                    if (onWrap && swapType !== BridgeType.deposit) onWrap().then(() => {
                      onClear()
                    })
                  }}>
                    {t('Confirm')}
                  </ButtonPrimary>
                )
              )
            }
          </BottomGrouping>
        </ConfirmContent>
      </ModalContent>
      <AppBody>
        <Title
          title={t('Deposited')} 
          
          tabList={[
            {
              name: t('Deposited'),
              onTabClick: () => {
                setSwapType(BridgeType.deposit)
              },
              iconUrl: require('../../assets/images/icon/deposit.svg'),
              iconActiveUrl: require('../../assets/images/icon/deposit-purple.svg')
            },
            {
              name: t('bridgeAssets'),
              onTabClick: () => {
                setSwapType(BridgeType.swapin)
              },
              iconUrl: require('../../assets/images/icon/send.svg'),
              iconActiveUrl: require('../../assets/images/icon/send-white.svg')
            },
            {
              name: t('redeem'),
              onTabClick: () => {
                setSwapType(BridgeType.swapout)
              },
              iconUrl: require('../../assets/images/icon/withdraw.svg'),
              iconActiveUrl: require('../../assets/images/icon/withdraw-purple.svg')
            }
          ]}
          currentTab={(() => {
            if (swapType === BridgeType.deposit) return 0
            if (swapType === BridgeType.swapin) return 1
            if (swapType === BridgeType.swapout) return 2
            return 0
          })()}
        ></Title>
        <AutoColumn gap={'sm'}>

          <SelectCurrencyInputPanel
            label={t('From')}
            value={inputBridgeValue}
            onUserInput={(value) => {
              // console.log(value)
              setInputBridgeValue(value)
            }}
            onCurrencySelect={(inputCurrency) => {
              // console.log(inputCurrency)
              setSelectCurrency(inputCurrency)
            }}
            onMax={(value) => {
              handleMaxInput(value)
            }}
            currency={formatCurrency ? formatCurrency : selectCurrency}
            disableCurrencySelect={false}
            disableChainSelect={swapType === BridgeType.deposit}
            showMaxButton={true}
            isViewNetwork={true}
            onOpenModalView={(value) => {
              console.log(value)
              setModalOpen(value)
            }}
            isViewModal={modalOpen}
            id="selectCurrency"
            isError={isInputError}
            isNativeToken={isNativeToken}
            allTokens={allTokens}
            hideBalance={swapType === BridgeType.deposit}
            customChainId={swapType === BridgeType.deposit ? selectCurrency?.symbol : ''}
          />
          {
            account && chainId && isUnderlying && isDestUnderlying ? (
              <LiquidityView>
                {t('pool') + ': '}
                {
                  curChain && isUnderlying ? (
                    <div className='item'>
                      <TokenLogo symbol={config.getCurChainInfo(curChain.chain).networkLogo ?? config.getCurChainInfo(curChain.chain)?.symbol} size={'1rem'}></TokenLogo>
                      <span className='cont'>{config.getCurChainInfo(curChain.chain).name}:{curChain.ts ? formatDecimal(curChain.ts, 2) : '0.00'}</span>
                    </div>
                  ) : ''
                }
                {
                  destChain && isDestUnderlying ? (
                    <div className='item'>
                      <TokenLogo symbol={config.getCurChainInfo(destChain.chain).networkLogo ?? config.getCurChainInfo(destChain.chain)?.symbol} size={'1rem'}></TokenLogo>
                      <span className='cont'>{config.getCurChainInfo(destChain.chain).name}:{destChain.ts ? formatDecimal(destChain.ts, 2) : '0.00'}</span>
                    </div>
                  ) : ''
                }
              </LiquidityView>
            ) : ''
          }

          <AutoRow justify="center" style={{ padding: '0 1rem' }}>
            <ArrowWrapper clickable={false} style={{cursor:'pointer'}} onClick={() => {
              // toggleNetworkModal()
              changeNetwork(selectChain)
            }}>
              <ArrowDown size="16" color={theme.text2} />
            </ArrowWrapper>
          </AutoRow>

          <SelectChainIdInputPanel
            label={t('to')}
            value={outputBridgeValue.toString()}
            onUserInput={(value) => {
              setInputBridgeValue(value)
            }}
            onChainSelect={(chainID) => {
              setSelectChain(chainID)
            }}
            selectChainId={selectChain}
            id="selectChainID"
            onOpenModalView={(value) => {
              console.log(value)
              setModalOpen(value)
            }}
            bridgeConfig={bridgeConfig}
            intervalCount={intervalCount}
            isNativeToken={false}
            selectChainList={selectChainList}
            // isViewAllChain={swapType === BridgeType.deposit}
          />
          {swapType === BridgeType.swapout ? (
            <AddressInputPanel id="recipient" value={recipient} onChange={setRecipient} />
          ): ''}
          {
            p2pAddress ? <AddressInputPanel id="p2pAddress" value={p2pAddress} disabledInput={true} /> : ''
          }
        </AutoColumn>

        {/* <Reminder bridgeConfig={bridgeConfig} bridgeType='bridgeAssets' currency={selectCurrency} /> */}
        <Reminder bridgeConfig={bridgeConfig} bridgeType={swapType} currency={selectCurrency} selectChain={selectChain}/>

        <BottomGrouping>
          {!account ? (
              <ButtonLight onClick={toggleWalletModal}>{t('ConnectWallet')}</ButtonLight>
            ) : (
              !isNativeToken && selectCurrency && selectCurrency.underlying && inputBridgeValue && (approval === ApprovalState.NOT_APPROVED || approval === ApprovalState.PENDING)? (
                <ButtonConfirmed
                  onClick={() => {
                    if (swapType !== BridgeType.deposit) {
                      setModalTipOpen(true)
                    } else {
                      setModalSpecOpen(true)
                    }
                  }}
                  disabled={approval !== ApprovalState.NOT_APPROVED || approvalSubmitted || delayAction}
                  width="48%"
                  altDisabledStyle={approval === ApprovalState.PENDING} // show solid button while waiting
                  // confirmed={approval === ApprovalState.APPROVED}
                >
                  {approval === ApprovalState.PENDING ? (
                    <AutoRow gap="6px" justify="center">
                      {t('Approving')} <Loader stroke="white" />
                    </AutoRow>
                  ) : approvalSubmitted ? (
                    t('Approved')
                  ) : (
                    t('Approve') + ' ' + config.getBaseCoin(selectCurrency?.underlying?.symbol ?? selectCurrency?.symbol, chainId)
                  )}
                </ButtonConfirmed>
              ) : (
                <ButtonPrimary disabled={isCrossBridge || delayAction} onClick={() => {
                  if (swapType !== BridgeType.deposit) {
                    setModalTipOpen(true)
                  } else {
                    setModalSpecOpen(true)
                  }
                }}>
                  {btnTxt}
                </ButtonPrimary>
              )
            )
          }
        </BottomGrouping>
      </AppBody>
    </>
  )
}