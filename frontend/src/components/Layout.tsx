import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space, Select, Alert, message, Drawer } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  DashboardOutlined,
  PlusSquareOutlined,
  UploadOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
  FundOutlined,
  GlobalOutlined,
  BarChartOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import HelpSystem from './HelpSystem';
import InteractiveGuide from './InteractiveGuide';

const { Header, Sider, Content } = Layout;
const { Option } = Select;

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutComponent: React.FC<LayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 画面サイズの検出
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setDrawerVisible(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 初回訪問時のオンボーディング表示
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding && location.pathname === '/dashboard') {
      setShowOnboarding(true);
    }
  }, [location.pathname]);

  // デモユーザー制限のためのナビゲーション
  const handleNavigate = (path: string) => {
    if (path === '/ad-submission' && user?.is_demo_user) {
      message.warning(t('demoUserRestriction'));
      return;
    }
    navigate(path);
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  const getGuideType = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'dashboard';
      case '/ad-submission':
        return 'campaign-creation';
      case '/bulk-upload':
        return 'bulk-upload';
      default:
        return 'onboarding';
    }
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('dashboard'),
      onClick: () => handleNavigate('/dashboard'),
    },
    {
      key: '/ad-submission',
      icon: <PlusSquareOutlined />,
      label: t('adSubmission'),
      onClick: () => handleNavigate('/ad-submission'),
    },
    {
      key: '/bulk-upload',
      icon: <UploadOutlined />,
      label: t('bulkUpload'),
      onClick: () => handleNavigate('/bulk-upload'),
    },
    {
      key: '/campaigns',
      icon: <FundOutlined />,
      label: t('campaigns'),
      onClick: () => handleNavigate('/campaigns'),
    },
    {
      key: '/reporting',
      icon: <BarChartOutlined />,
      label: t('reporting'),
      onClick: () => handleNavigate('/reporting'),
    },
    {
      key: '/alerts',
      icon: <BellOutlined />,
      label: t('alerts'),
      onClick: () => handleNavigate('/alerts'),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('settings'),
      onClick: () => handleNavigate('/settings'),
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('logout'),
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      {/* デスクトップ用サイドバー */}
      {!isMobile && (
        <Sider 
          trigger={null} 
          width={256}
          collapsed={sidebarCollapsed}
          collapsedWidth={80}
          collapsible
          style={{
            position: 'fixed',
            height: '100vh',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 1001
          }}
        >
        <div style={{ 
          height: 32, 
          margin: 16, 
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px'
        }}>
          <span></span>
          <span style={{ color: 'white', fontSize: '12px' }}>{t('menu')}</span>
                    {!sidebarCollapsed && (
                      <Button
                        type="text"
                        icon={<MenuOutlined />}
                        onClick={() => setSidebarCollapsed(true)}
                        style={{
                          color: 'white',
                          fontSize: '12px',
                          padding: '4px',
                          height: 'auto',
                          lineHeight: 1
                        }}
                        title={t('collapse')}
                      />
                    )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(e) => e.domEvent.stopPropagation()}
          className="sidebar-menu"
        />
        </Sider>
      )}

      {/* モバイル用Drawer */}
      <Drawer
        title={t('menu')}
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={256}
        bodyStyle={{ padding: 0, background: '#001529' }}
        headerStyle={{ background: '#001529', borderBottom: '1px solid #303030' }}
      >
        <div style={{ 
          height: 32, 
          margin: 16, 
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px'
        }}>
          <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>{t('menu')}</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(e) => e.domEvent.stopPropagation()}
        />
      </Drawer>
      <Layout style={{ width: '100%', marginLeft: 0 }}>
        <Header style={{ 
          padding: isMobile ? '0 12px' : '0 16px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          width: isMobile ? '100%' : (sidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'),
          marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 256),
          transition: 'all 0.3s ease',
          boxSizing: 'border-box'
        }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => isMobile ? setDrawerVisible(true) : setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              fontSize: isMobile ? '18px' : '16px',
              width: isMobile ? 48 : 64,
              height: isMobile ? 48 : 64,
            }}
            title={isMobile ? t('openMenu') : (sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar'))}
          />
          
          <Space size={isMobile ? 'small' : 'middle'}>
            <Select
              defaultValue={i18n.language}
              onChange={handleLanguageChange}
              style={{ width: isMobile ? 100 : 120 }}
              size={isMobile ? 'small' : 'middle'}
              suffixIcon={<GlobalOutlined />}
            >
              <Option value="en">English</Option>
              <Option value="ja">日本語</Option>
              <Option value="zh">中文</Option>
              <Option value="ko">한국어</Option>
            </Select>
            
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
            >
              <Avatar icon={<UserOutlined />} />
            </Dropdown>
          </Space>
        </Header>

        {/* デモユーザー制限アラート */}
        {user?.is_demo_user && (
          <Alert
            message={t('demoMode')}
            description={t('demoModeDescription')}
            type="info"
            showIcon
            closable
            style={{ margin: 16 }}
          />
        )}

        <Content
          style={{
            margin: isMobile ? '16px 12px' : '16px 16px 16px 0',
            padding: isMobile ? 16 : 24,
            minHeight: 280,
            background: '#fff',
            width: isMobile ? 'calc(100% - 24px)' : (sidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'),
            maxWidth: '100%',
            boxSizing: 'border-box',
            marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 256),
            transition: 'all 0.3s ease',
            overflow: 'hidden'
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* ヘルプシステム */}
      <HelpSystem />

      {/* インタラクティブガイド */}
      <InteractiveGuide
        visible={guideVisible || showOnboarding}
        onClose={() => {
          setGuideVisible(false);
          if (showOnboarding) {
            handleOnboardingComplete();
          }
        }}
        guideType={getGuideType() as any}
      />
    </Layout>
  );
};

export default LayoutComponent;