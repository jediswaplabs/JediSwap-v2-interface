import { CustomUserProperties, getBrowser, SharedEventName } from '@uniswap/analytics-events'
import { useWeb3React } from '@web3-react/core'
import ErrorBoundary from 'components/ErrorBoundary'
import Loader from 'components/Icons/LoadingSpinner'
import NavBar, { PageTabs } from 'components/NavBar'
import { FeatureFlag, useFeatureFlagsIsLoaded } from 'featureFlags'
import { useUniswapXDefaultEnabled } from 'featureFlags/flags/uniswapXDefault'
import { useAtom } from 'jotai'
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { shouldDisableNFTRoutesAtom } from 'state/application/atoms'
import { useAppSelector } from 'state/hooks'
import { AppState } from 'state/reducer'
import { RouterPreference } from 'state/routing/types'
import { useRouterPreference, useUserOptedOutOfUniswapX } from 'state/user/hooks'
import { StatsigProvider, StatsigUser, useGate } from 'statsig-react'
import styled from 'styled-components'
import { useIsDarkMode } from 'theme/components/ThemeToggle'
import { flexRowNoWrap } from 'theme/styles'
import { Z_INDEX } from 'theme/zIndex'
import { getEnvName } from 'utils/env'
import { getDownloadAppLink } from 'utils/openDownloadApp'
import { getCurrentPageFromLocation } from 'utils/urlRoutes'

import { RouteDefinition, routes, useRouterConfig } from './RouteDefinitions'

const BodyWrapper = styled.div<{ bannerIsVisible?: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: calc(100vh);
  padding: ${({ theme }) => theme.navHeight}px 0px 5rem 0px;
  align-items: center;
  flex: 1;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    min-height: calc(100vh);
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    min-height: calc(100vh);
  }
`

const MobileBottomBar = styled.div`
  z-index: ${Z_INDEX.sticky};
  position: fixed;
  display: flex;
  bottom: 0;
  right: 0;
  left: 0;
  width: calc(100vw - 16px);
  justify-content: space-between;
  padding: 0px 4px;
  height: ${({ theme }) => theme.mobileBottomBarHeight}px;
  background: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  margin: 8px;
  border-radius: 20px;

  @media screen and (min-width: ${({ theme }) => theme.breakpoint.md}px) {
    display: none;
  }
`

const HeaderWrapper = styled.div<{ transparent?: boolean; bannerIsVisible?: boolean; scrollY: number }>`
  ${flexRowNoWrap};
  background-color: ${({ theme, transparent }) => !transparent && theme.surface1};
  border-bottom: ${({ theme, transparent }) => !transparent && `1px solid ${theme.surface3}`};
  width: 100%;
  justify-content: space-between;
  position: fixed;
  top: 0;
  z-index: ${Z_INDEX.dropdown};

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    top: 0;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    top: 0;
  }
`

export default function App() {
  const isLoaded = useFeatureFlagsIsLoaded()

  const location = useLocation()
  const { pathname } = location

  const [scrollY, setScrollY] = useState(0)
  const routerConfig = useRouterConfig()

  useEffect(() => {
    window.scrollTo(0, 0)
    setScrollY(0)
  }, [pathname])

  useEffect(() => {
    const scrollListener = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', scrollListener)
    return () => window.removeEventListener('scroll', scrollListener)
  }, [])

  return (
    <ErrorBoundary>
          <HeaderWrapper  scrollY={scrollY}>
            <NavBar blur={false} />
          </HeaderWrapper>
          <BodyWrapper>
            <Suspense fallback={<Loader />}>
              {isLoaded ? (
                <Routes>
                  {routes.map((route: RouteDefinition) =>
                    route.enabled(routerConfig) ? (
                      <Route key={route.path} path={route.path} element={route.getElement(routerConfig)}>
                        {route.nestedPaths.map((nestedPath) => (
                          <Route path={nestedPath} key={`${route.path}/${nestedPath}`} />
                        ))}
                      </Route>
                    ) : null
                  )}
                </Routes>
              ) : (
                <Loader />
              )}
            </Suspense>
          </BodyWrapper>
          <MobileBottomBar>
            <PageTabs />
          </MobileBottomBar>
    </ErrorBoundary>
  )
}
