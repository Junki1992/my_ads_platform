import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          padding: '20px'
        }}>
          <Result
            status="warning"
            title="ページの読み込みに問題が発生しました"
            subTitle="ブラウザの「戻る」ボタンを使用した場合、このエラーが発生することがあります。ページを更新してください。"
            extra={[
              <Button type="primary" key="reload" onClick={this.handleReload}>
                ページを更新
              </Button>,
              <Button key="home" onClick={this.handleGoHome}>
                ホームに戻る
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

