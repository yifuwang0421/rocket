import * as React from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ResearchLayoutErrorBoundaryProps {
  children: React.ReactNode
  resetKey: string | null
}

interface ResearchLayoutErrorBoundaryState {
  error: Error | null
}

export class ResearchLayoutErrorBoundary extends React.Component<
  ResearchLayoutErrorBoundaryProps,
  ResearchLayoutErrorBoundaryState
> {
  state: ResearchLayoutErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ResearchLayoutErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[research-layout] render failed', error, info.componentStack)
  }

  componentDidUpdate(previousProps: ResearchLayoutErrorBoundaryProps): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private retry = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex h-full w-full items-center justify-center bg-background p-6">
        <section
          role="alert"
          aria-labelledby="research-layout-error-title"
          className="w-full max-w-md rounded-[12px] border border-destructive/20 bg-destructive/5 p-5 shadow-minimal"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h1 id="research-layout-error-title" className="text-sm font-semibold">投研工作台暂时无法显示</h1>
              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                {this.state.error.message || '界面遇到未知错误。可先重试；若问题持续，请重新加载 Rocket。'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={this.retry}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />重试
                </Button>
                <Button size="sm" onClick={() => window.location.reload()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />重新加载
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }
}
