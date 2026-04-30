import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Alert,
  Checkbox,
  Spin,
  Empty,
  Collapse,
  Pagination,
  Switch,
  Typography,
  Progress,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, PauseOutlined, PlayCircleOutlined, DeleteOutlined, SyncOutlined, DownloadOutlined } from '@ant-design/icons';
import campaignService, { Campaign, CampaignCreate } from '../services/campaignService';
import adSetService, { AdSet } from '../services/adSetService';
import adService, { Ad } from '../services/adService';
import metaAccountService, { MetaAccount } from '../services/metaAccountService';
import { groupByLinkedMetaAdAccount } from '../utils/metaAccountBusinessGroups';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

/** 一覧の消化（API の spend / 文字列・カンマ対応） */
function parseCampaignSpend(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** キャッシュ済みで消化が 1 円以上あるか（null・— は「なし」扱い） */
function campaignHasSpendAmount(c: Campaign): boolean {
  if (c.spend == null) return false;
  return parseCampaignSpend(c.spend) !== 0;
}

/** 一覧は広告アカウント単位でまとめるため全件取得（API は 100 件/ページ上限） */
const CAMPAIGN_LIST_FETCH_PAGE_SIZE = 100;
const SYNC_PROGRESS_POLL_INTERVAL_MS = 5000;
const SYNC_STUCK_WARNING_MS = 5 * 60 * 1000;

const Campaigns: React.FC = () => {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [selectedMetaAccountIds, setSelectedMetaAccountIds] = useState<number[]>([]);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncProgressVisible, setSyncProgressVisible] = useState(false);
  const [syncProgressTotal, setSyncProgressTotal] = useState(0);
  const [syncProgressDone, setSyncProgressDone] = useState(0);
  const [syncProgressStartedAt, setSyncProgressStartedAt] = useState<string | null>(null);
  const [syncProgressUnknownTotal, setSyncProgressUnknownTotal] = useState(false);
  const [syncAllTaskId, setSyncAllTaskId] = useState<string | null>(null);
  const [syncAllTaskState, setSyncAllTaskState] = useState<'idle' | 'pending' | 'success' | 'failure'>('idle');
  const [syncAllTaskMessage, setSyncAllTaskMessage] = useState<string>('');
  const [syncProgressLastUpdatedAt, setSyncProgressLastUpdatedAt] = useState<number | null>(null);
  const [syncProgressStuck, setSyncProgressStuck] = useState(false);
  /** 消化が未計測（—）または 0 円の行を一覧から除外 */
  const [hideCampaignsWithoutSpend, setHideCampaignsWithoutSpend] = useState(true);

  const campaignsVisibleInList = useMemo(() => {
    if (!hideCampaignsWithoutSpend) return campaigns;
    return campaigns.filter(campaignHasSpendAmount);
  }, [campaigns, hideCampaignsWithoutSpend]);

  const campaignListGroups = useMemo(
    () => groupByLinkedMetaAdAccount(campaignsVisibleInList, t('metaAdAccountGroupUngrouped')),
    [campaignsVisibleInList, t],
  );

  const [campaignListCollapseActiveKeys, setCampaignListCollapseActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    setCampaignListCollapseActiveKeys([]);
  }, [campaignsVisibleInList]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const merged: Campaign[] = [];
      let page = 1;
      for (;;) {
        const data = await campaignService.getCampaigns({
          page,
          page_size: CAMPAIGN_LIST_FETCH_PAGE_SIZE,
        });
        merged.push(...data.results);
        const total = data.count ?? merged.length;
        if (merged.length >= total || data.results.length === 0) break;
        page += 1;
        if (page > 200) break;
      }
      setCampaigns(merged);
    } catch (error) {
      message.error('キャンペーンの取得に失敗しました');
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchMetaAccounts();
  }, []);

  useEffect(() => {
    if (!syncProgressVisible || syncProgressTotal <= 0 || !syncProgressStartedAt) return;

    const startedAtMs = Date.parse(syncProgressStartedAt);
    const timer = window.setInterval(() => {
      const done = campaigns.filter((campaign) => {
        if (!campaign.campaign_id || String(campaign.campaign_id).startsWith('camp_')) return false;
        if (!campaign.insights_updated_at) return false;
        const updatedAtMs = Date.parse(campaign.insights_updated_at);
        return Number.isFinite(updatedAtMs) && updatedAtMs >= startedAtMs;
      }).length;

      setSyncProgressDone(done);

      if (done >= syncProgressTotal) {
        setSyncProgressVisible(false);
        setSyncProgressStuck(false);
        message.success(`同期の進捗: ${done}/${syncProgressTotal} 件完了`);
      } else if (done > syncProgressDone) {
        setSyncProgressLastUpdatedAt(Date.now());
        setSyncProgressStuck(false);
      }
    }, SYNC_PROGRESS_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [campaigns, syncProgressDone, syncProgressVisible, syncProgressStartedAt, syncProgressTotal]);

  useEffect(() => {
    if (!syncProgressVisible || syncAllTaskState !== 'pending') return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      const base = syncProgressLastUpdatedAt ?? (syncProgressStartedAt ? Date.parse(syncProgressStartedAt) : now);
      if (Number.isFinite(base) && now - base >= SYNC_STUCK_WARNING_MS) {
        setSyncProgressStuck(true);
      }
    }, SYNC_PROGRESS_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [syncAllTaskState, syncProgressLastUpdatedAt, syncProgressStartedAt, syncProgressVisible]);

  useEffect(() => {
    if (!syncAllTaskId) return;
    if (syncAllTaskState === 'success' || syncAllTaskState === 'failure') return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const status = await campaignService.getSyncAllCampaignsStatus(syncAllTaskId);
        if (cancelled) return;

        const state = String(status.state || '').toUpperCase();
        if (state === 'SUCCESS') {
          setSyncAllTaskState('success');
          const result = status.result ?? {};
          const totalCampaigns = Number(result.total_campaigns ?? 0);
          const successfulSyncs = Number(result.successful_syncs ?? 0);
          const queued = Number(result.insights_tasks_queued ?? syncProgressTotal ?? 0);

          setSyncAllTaskMessage(
            status.message ||
              `同期完了: ステータス同期 ${successfulSyncs}/${totalCampaigns}, インサイトキュー ${queued} 件`,
          );

          if (queued > 0) {
            setSyncProgressUnknownTotal(false);
            setSyncProgressTotal(queued);
          }
          void fetchCampaigns();
        } else if (state === 'FAILURE') {
          setSyncAllTaskState('failure');
          setSyncAllTaskMessage(status.error || status.message || '同期に失敗しました');
          setSyncProgressVisible(false);
          setSyncProgressUnknownTotal(false);
        } else {
          setSyncAllTaskState('pending');
          if (status.message) setSyncAllTaskMessage(status.message);
          void fetchCampaigns();
        }
      } catch (e) {
        if (cancelled) return;
        setSyncAllTaskState('failure');
        setSyncAllTaskMessage('同期ステータス取得に失敗しました');
        setSyncProgressVisible(false);
      }
    }, SYNC_PROGRESS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [syncAllTaskId, syncAllTaskState, syncProgressTotal]);

  // Meta アカウント一覧を取得
  const fetchMetaAccounts = async () => {
    try {
      const accounts = await metaAccountService.getMetaAccounts();
      setMetaAccounts(accounts);
    } catch (error) {
      console.error('Failed to fetch Meta accounts:', error);
    }
  };

  // デモ制限アラートを追加
  const isDemoMode = campaigns.some(campaign => 
    campaign.name?.toLowerCase().includes('demo') || 
    campaign.name?.toLowerCase().includes('test')
  );

  // 新規作成モーダルを開く
  const handleCreate = () => {
    setEditingCampaign(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 編集モーダルを開く
  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    form.setFieldsValue({
      name: campaign.name,
      objective: campaign.objective,
      budget: campaign.budget,
      budget_type: campaign.budget_type,
      dateRange: [dayjs(campaign.start_date), campaign.end_date ? dayjs(campaign.end_date) : null],
    });
    setModalVisible(true);
  };

  // キャンペーン保存
  const handleSubmit = async (values: any) => {
    try {
      const campaignData: CampaignCreate = {
        name: values.name,
        objective: values.objective,
        budget: values.budget,
        budget_type: values.budget_type,
        start_date: values.dateRange[0].toISOString(),
        end_date: values.dateRange[1] ? values.dateRange[1].toISOString() : undefined,
      };

      if (editingCampaign) {
        await campaignService.updateCampaign(editingCampaign.id, campaignData);
        message.success('キャンペーンを更新しました');
      } else {
        await campaignService.createCampaign(campaignData);
        message.success('キャンペーンを作成しました');
      }

      setModalVisible(false);
      fetchCampaigns();
    } catch (error) {
      message.error('保存に失敗しました');
      console.error('Failed to save campaign:', error);
    }
  };

  // キャンペーン有効化/一時停止
  const handleToggleStatus = async (campaign: Campaign) => {
    try {
      if (campaign.status === 'ACTIVE') {
        const result = await campaignService.pauseCampaign(campaign.id);
        
        // 結果に応じてメッセージを表示
        if (result.status === 'Campaign paused') {
          message.success(result.message);
        } else if (result.status === 'Campaign paused with warning') {
          message.warning(result.message);
        } else if (result.status === 'Campaign paused locally with error') {
          message.error(result.message);
        } else {
          message.success('キャンペーンを一時停止しました');
        }
      } else {
        const result = await campaignService.activateCampaign(campaign.id);
        
        // 結果に応じてメッセージを表示
        if (result.status === 'Campaign activated') {
          message.success(result.message);
        } else if (result.status === 'Campaign activated with warning') {
          message.warning(result.message);
        } else if (result.status === 'Campaign activated locally with error') {
          message.error(result.message);
        } else {
          message.success('キャンペーンを有効化しました');
        }
      }
      fetchCampaigns();
    } catch (error) {
      message.error('ステータスの変更に失敗しました');
      console.error('Failed to toggle campaign status:', error);
    }
  };

  // キャンペーン削除（新しいオプション付き削除）
  const handleDelete = (campaign: Campaign) => {
    // 削除オプション選択モーダルを表示
    Modal.confirm({
      title: 'キャンペーン削除オプション',
      content: (
        <div>
          <p>「{campaign.name}」を削除します。</p>
          <p>削除方法を選択してください：</p>
          <ul>
            <li><strong>ローカルのみ削除</strong>：アプリ内から削除（Meta広告マネージャーには影響なし）</li>
            <li><strong>Meta広告マネージャーからも削除</strong>：Meta広告マネージャーから完全に削除</li>
          </ul>
        </div>
      ),
      okText: '削除オプションを選択',
      okType: 'primary',
      cancelText: 'キャンセル',
      onOk: () => {
        // 削除オプション選択モーダルを表示
        showDeleteOptionsModal(campaign);
      },
    });
  };

  // 削除オプション選択モーダル
  const showDeleteOptionsModal = (campaign: Campaign) => {
    Modal.confirm({
      title: '削除方法を選択',
      content: (
        <div>
          <p>「{campaign.name}」の削除方法を選択してください：</p>
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <input 
                type="radio" 
                id="localOnly" 
                name="deleteOption" 
                value="localOnly" 
                defaultChecked 
                style={{ marginRight: '8px' }}
              />
              <label htmlFor="localOnly">
                <strong>ローカルのみ削除</strong><br/>
                <small>アプリ内から削除（Meta広告マネージャーには影響なし）</small>
              </label>
            </div>
            <div>
              <input 
                type="radio" 
                id="metaAlso" 
                name="deleteOption" 
                value="metaAlso" 
                style={{ marginRight: '8px' }}
              />
              <label htmlFor="metaAlso">
                <strong>Meta広告マネージャーからも削除</strong><br/>
                <small>Meta広告マネージャーから完全に削除（パスワード認証が必要）</small>
              </label>
            </div>
          </div>
        </div>
      ),
      okText: '削除実行',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: () => {
        const selectedOption = document.querySelector('input[name="deleteOption"]:checked') as HTMLInputElement;
        if (selectedOption) {
          if (selectedOption.value === 'metaAlso') {
            // Meta広告マネージャーからも削除する場合はパスワード入力モーダルを表示
            showPasswordModal(campaign);
          } else {
            // ローカルのみ削除
            executeDelete(campaign, false);
          }
        }
      },
    });
  };

  // パスワード入力モーダル
  const showPasswordModal = (campaign: Campaign) => {
    let password = '';
    
    Modal.confirm({
      title: 'パスワード認証',
      content: (
        <div>
          <p>Meta広告マネージャーからも削除するには、ログインパスワードが必要です。</p>
          <p><strong>注意：</strong>この操作は取り消せません。</p>
          <input
            type="password"
            placeholder="ログインパスワードを入力"
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px'
            }}
            onChange={(e) => {
              password = e.target.value;
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                Modal.destroyAll();
                executeDelete(campaign, true, password);
              }
            }}
          />
        </div>
      ),
      okText: '削除実行',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: () => {
        if (!password.trim()) {
          message.error('パスワードを入力してください');
          return false;
        }
        Modal.destroyAll();
        executeDelete(campaign, true, password);
      },
    });
  };

  // 実際の削除処理を実行
  const executeDelete = async (campaign: Campaign, deleteFromMeta: boolean, password?: string) => {
    try {
      if (deleteFromMeta && password) {
        // Meta広告マネージャーからも削除
        const result = await campaignService.deleteCampaignWithOptions(campaign.id, {
          deleteFromMeta: true,
          password: password
        });
        
        // 同期的に実行されるため、結果を直接表示
        if (result.status === 'Campaign deleted from Meta and locally') {
          message.success(result.message);
        } else if (result.status === 'Campaign deleted locally with warning') {
          message.warning(result.message);
        } else if (result.status === 'Campaign deleted locally with error') {
          message.error(result.message);
        } else {
          message.success(result.message);
        }
      } else {
        // ローカルのみ削除
        const result = await campaignService.deleteCampaignWithOptions(campaign.id, {
          deleteFromMeta: false
        });
        message.success(result.message);
      }
      
      fetchCampaigns();
    } catch (error: any) {
      if (error.response?.status === 401) {
        message.error('パスワードが正しくありません');
      } else if (error.response?.status === 400) {
        message.error(error.response.data.error || 'リクエストが無効です');
      } else {
        message.error('削除に失敗しました');
        console.error('Failed to delete campaign:', error);
      }
    }
  };

  // キャンペーン詳細モーダルを開く
  const handleRowClick = async (record: Campaign) => {
    setSelectedCampaign(record);
    setDetailModalVisible(true);
    
    // 広告セットと広告の詳細を取得
    setLoadingDetails(true);
    try {
      console.log('Fetching campaign details for campaign ID:', record.id);
      
      // まず広告セットを取得
      const adsetsData = await adSetService.getAdSets(record.id);
      console.log('Fetched adsets:', adsetsData);
      console.log('Adsets data type:', typeof adsetsData);
      console.log('Is adsets array:', Array.isArray(adsetsData));
      
      // 配列であることを確認
      const safeAdsetsData = Array.isArray(adsetsData) ? adsetsData : [];
      console.log('Number of adsets found:', safeAdsetsData.length);
      
      // 広告セットが存在する場合、各広告セットの広告を取得
      let allAds: Ad[] = [];
      if (safeAdsetsData.length > 0) {
        console.log('Fetching ads for adsets:', safeAdsetsData.map(adset => ({ id: adset.id, name: adset.name })));
        const adPromises = safeAdsetsData.map(adset => {
          console.log(`Fetching ads for adset ID: ${adset.id}`);
          return adService.getAds(adset.id);
        });
        const adResults = await Promise.all(adPromises);
        allAds = adResults.flat().filter(ad => ad && typeof ad === 'object');
        console.log('Fetched ads:', allAds);
        console.log('Number of ads found:', allAds.length);
      } else {
        console.log('No adsets found for this campaign');
      }
      
      setAdsets(safeAdsetsData);
      setAds(allAds);
      
      // 自動同期を実行（バックグラウンド）
      try {
        console.log('Starting automatic sync from Meta API...');
        await campaignService.syncCampaignFullFromMeta(record.id);
        console.log('Automatic sync completed');
        
        // 同期後にデータを再取得
        const syncedAdsetsData = await adSetService.getAdSets(record.id);
        const safeSyncedAdsetsData = Array.isArray(syncedAdsetsData) ? syncedAdsetsData : [];
        
        let syncedAds: Ad[] = [];
        if (safeSyncedAdsetsData.length > 0) {
          const syncedAdPromises = safeSyncedAdsetsData.map(adset => adService.getAds(adset.id));
          const syncedAdResults = await Promise.all(syncedAdPromises);
          syncedAds = syncedAdResults.flat().filter(ad => ad && typeof ad === 'object');
        }
        
        setAdsets(safeSyncedAdsetsData);
        setAds(syncedAds);
        console.log('Data refreshed after sync');
      } catch (syncError) {
        console.warn('Automatic sync failed:', syncError);
        // 同期エラーは警告として表示するが、メインの処理は継続
      }
      
    } catch (error) {
      console.error('Failed to fetch campaign details:', error);
      message.error('詳細情報の取得に失敗しました');
    } finally {
      setLoadingDetails(false);
    }
  };

  // 詳細モーダル内で編集
  const handleEditFromDetail = () => {
    setDetailModalVisible(false);
    handleEdit(selectedCampaign!);
  };

  // 詳細モーダル内でステータス変更
  const handleToggleStatusFromDetail = async () => {
    if (!selectedCampaign) return;
    try {
      if (selectedCampaign.status === 'ACTIVE') {
        const result = await campaignService.pauseCampaign(selectedCampaign.id);
        
        // 結果に応じてメッセージを表示
        if (result.status === 'Campaign paused') {
          message.success(result.message);
        } else if (result.status === 'Campaign paused with warning') {
          message.warning(result.message);
        } else if (result.status === 'Campaign paused locally with error') {
          message.error(result.message);
        } else {
          message.success('キャンペーンを一時停止しました');
        }
      } else {
        const result = await campaignService.activateCampaign(selectedCampaign.id);
        
        // 結果に応じてメッセージを表示
        if (result.status === 'Campaign activated') {
          message.success(result.message);
        } else if (result.status === 'Campaign activated with warning') {
          message.warning(result.message);
        } else if (result.status === 'Campaign activated locally with error') {
          message.error(result.message);
        } else {
          message.success('キャンペーンを有効化しました');
        }
      }
      fetchCampaigns();
      setDetailModalVisible(false);
    } catch (error) {
      message.error('ステータスの変更に失敗しました');
      console.error('Failed to toggle campaign status:', error);
    }
  };

  // 広告セットのステータス変更
  const handleToggleAdSetStatus = async (adset: AdSet) => {
    try {
      if (adset.status === 'ACTIVE') {
        const result = await adSetService.pauseAdSet(adset.id);
        
        if (result.status === 'AdSet paused') {
          message.success(result.message);
        } else if (result.status === 'AdSet paused with warning') {
          message.warning(result.message);
        } else if (result.status === 'AdSet paused locally with error') {
          message.error(result.message);
        } else {
          message.success('広告セットを一時停止しました');
        }
      } else {
        const result = await adSetService.activateAdSet(adset.id);
        
        if (result.status === 'AdSet activated') {
          message.success(result.message);
        } else if (result.status === 'AdSet activated with warning') {
          message.warning(result.message);
        } else if (result.status === 'AdSet activated locally with error') {
          message.error(result.message);
        } else {
          message.success('広告セットを有効化しました');
        }
      }
      
      // 広告セット一覧を再取得
      if (selectedCampaign) {
        const adsetsData = await adSetService.getAdSets(selectedCampaign.id);
        const safeAdsetsData = Array.isArray(adsetsData) ? adsetsData : [];
        setAdsets(safeAdsetsData);
        
        // 広告も再取得
        let allAds: Ad[] = [];
        if (safeAdsetsData.length > 0) {
          const adPromises = safeAdsetsData.map(adset => adService.getAds(adset.id));
          const adResults = await Promise.all(adPromises);
          allAds = adResults.flat().filter(ad => ad && typeof ad === 'object');
        }
        setAds(allAds);
      }
    } catch (error) {
      message.error('広告セットのステータス変更に失敗しました');
      console.error('Failed to toggle adset status:', error);
    }
  };

  // 広告のステータス変更
  const handleToggleAdStatus = async (ad: Ad) => {
    try {
      if (ad.status === 'ACTIVE') {
        const result = await adService.pauseAd(ad.id);
        
        if (result.status === 'Ad paused') {
          message.success(result.message);
        } else if (result.status === 'Ad paused with warning') {
          message.warning(result.message);
        } else if (result.status === 'Ad paused locally with error') {
          message.error(result.message);
        } else {
          message.success('広告を一時停止しました');
        }
      } else {
        const result = await adService.activateAd(ad.id);
        
        if (result.status === 'Ad activated') {
          message.success(result.message);
        } else if (result.status === 'Ad activated with warning') {
          message.warning(result.message);
        } else if (result.status === 'Ad activated locally with error') {
          message.error(result.message);
        } else {
          message.success('広告を有効化しました');
        }
      }
      
      // 広告一覧を再取得
      if (selectedCampaign) {
        let allAds: Ad[] = [];
        const safeAdsets = Array.isArray(adsets) ? adsets : [];
        if (safeAdsets.length > 0) {
          const adPromises = safeAdsets.map(adset => adService.getAds(adset.id));
          const adResults = await Promise.all(adPromises);
          allAds = adResults.flat().filter(ad => ad && typeof ad === 'object');
        }
        setAds(allAds);
      }
    } catch (error) {
      message.error('広告のステータス変更に失敗しました');
      console.error('Failed to toggle ad status:', error);
    }
  };

  // 詳細モーダル内で削除
  const handleDeleteFromDetail = () => {
    if (!selectedCampaign) return;
    
    // 削除オプション選択モーダルを表示
    Modal.confirm({
      title: 'キャンペーン削除オプション',
      content: (
        <div>
          <p>「{selectedCampaign.name}」を削除します。</p>
          <p>削除方法を選択してください：</p>
          <ul>
            <li><strong>ローカルのみ削除</strong>：アプリ内から削除（Meta広告マネージャーには影響なし）</li>
            <li><strong>Meta広告マネージャーからも削除</strong>：Meta広告マネージャーから完全に削除</li>
          </ul>
        </div>
      ),
      okText: '削除オプションを選択',
      okType: 'primary',
      cancelText: 'キャンセル',
      onOk: () => {
        // 削除オプション選択モーダルを表示
        showDeleteOptionsModalFromDetail(selectedCampaign);
      },
    });
  };

  // 詳細モーダル用削除オプション選択モーダル
  const showDeleteOptionsModalFromDetail = (campaign: Campaign) => {
    Modal.confirm({
      title: '削除方法を選択',
      content: (
        <div>
          <p>「{campaign.name}」の削除方法を選択してください：</p>
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <input 
                type="radio" 
                id="localOnlyDetail" 
                name="deleteOptionDetail" 
                value="localOnly" 
                defaultChecked 
                style={{ marginRight: '8px' }}
              />
              <label htmlFor="localOnlyDetail">
                <strong>ローカルのみ削除</strong><br/>
                <small>アプリ内から削除（Meta広告マネージャーには影響なし）</small>
              </label>
            </div>
            <div>
              <input 
                type="radio" 
                id="metaAlsoDetail" 
                name="deleteOptionDetail" 
                value="metaAlso" 
                style={{ marginRight: '8px' }}
              />
              <label htmlFor="metaAlsoDetail">
                <strong>Meta広告マネージャーからも削除</strong><br/>
                <small>Meta広告マネージャーから完全に削除（パスワード認証が必要）</small>
              </label>
            </div>
          </div>
        </div>
      ),
      okText: '削除実行',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: () => {
        const selectedOption = document.querySelector('input[name="deleteOptionDetail"]:checked') as HTMLInputElement;
        if (selectedOption) {
          if (selectedOption.value === 'metaAlso') {
            // Meta広告マネージャーからも削除する場合はパスワード入力モーダルを表示
            showPasswordModalFromDetail(campaign);
          } else {
            // ローカルのみ削除
            executeDeleteFromDetail(campaign, false);
          }
        }
      },
    });
  };

  // 詳細モーダル用パスワード入力モーダル
  const showPasswordModalFromDetail = (campaign: Campaign) => {
    let password = '';
    
    Modal.confirm({
      title: 'パスワード認証',
      content: (
        <div>
          <p>Meta広告マネージャーからも削除するには、ログインパスワードが必要です。</p>
          <p><strong>注意：</strong>この操作は取り消せません。</p>
          <input
            type="password"
            placeholder="ログインパスワードを入力"
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px'
            }}
            onChange={(e) => {
              password = e.target.value;
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                Modal.destroyAll();
                executeDeleteFromDetail(campaign, true, password);
              }
            }}
          />
        </div>
      ),
      okText: '削除実行',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: () => {
        if (!password.trim()) {
          message.error('パスワードを入力してください');
          return false;
        }
        Modal.destroyAll();
        executeDeleteFromDetail(campaign, true, password);
      },
    });
  };

  // 詳細モーダル用実際の削除処理を実行
  const executeDeleteFromDetail = async (campaign: Campaign, deleteFromMeta: boolean, password?: string) => {
    try {
      if (deleteFromMeta && password) {
        // Meta広告マネージャーからも削除
        const result = await campaignService.deleteCampaignWithOptions(campaign.id, {
          deleteFromMeta: true,
          password: password
        });
        
        // 同期的に実行されるため、結果を直接表示
        if (result.status === 'Campaign deleted from Meta and locally') {
          message.success(result.message);
        } else if (result.status === 'Campaign deleted locally with warning') {
          message.warning(result.message);
        } else if (result.status === 'Campaign deleted locally with error') {
          message.error(result.message);
        } else {
          message.success(result.message);
        }
      } else {
        // ローカルのみ削除
        const result = await campaignService.deleteCampaignWithOptions(campaign.id, {
          deleteFromMeta: false
        });
        message.success(result.message);
      }
      
      fetchCampaigns();
      setDetailModalVisible(false);
    } catch (error: any) {
      if (error.response?.status === 401) {
        message.error('パスワードが正しくありません');
      } else if (error.response?.status === 400) {
        message.error(error.response.data.error || 'リクエストが無効です');
      } else {
        message.error('削除に失敗しました');
        console.error('Failed to delete campaign:', error);
      }
    }
  };

  // 単一キャンペーンのMeta API同期
  const handleSyncCampaign = async (campaign: Campaign) => {
    try {
      const result = await campaignService.syncCampaignFromMeta(campaign.id);
      
      if (result.status === 'success') {
        if (result.local_status !== result.meta_status) {
          message.success(`キャンペーン「${campaign.name}」を同期しました: ${result.meta_status}`);
        } else {
          message.info(`キャンペーン「${campaign.name}」は既に同期済みです: ${result.meta_status}`);
        }
      } else if (result.status === 'warning') {
        message.warning(result.message);
      } else {
        message.error(result.message);
      }
      
      fetchCampaigns();
    } catch (error) {
      message.error('同期に失敗しました');
      console.error('Failed to sync campaign:', error);
    }
  };

  // すべてのキャンペーンのMeta API同期（バックエンド: ステータス一括 + インサイト取得タスクをキュー）
  const handleSyncAllCampaigns = async () => {
    setSyncAllLoading(true);
    // 押下直後に「同期中」を必ず可視化（API応答待ち中でも表示）
    setSyncProgressVisible(true);
    setSyncProgressUnknownTotal(true);
    setSyncProgressTotal(0);
    setSyncProgressDone(0);
    setSyncProgressStartedAt(null);
    setSyncProgressLastUpdatedAt(Date.now());
    setSyncProgressStuck(false);
    setSyncAllTaskId(null);
    setSyncAllTaskState('pending');
    setSyncAllTaskMessage('同期リクエストを送信中です');
    try {
      const result = await campaignService.syncAllCampaignsFromMeta();
      const est = result.insights_tasks_queued_estimate;
      if (result.task_id) {
        setSyncAllTaskId(result.task_id);
        setSyncAllTaskState('pending');
        setSyncAllTaskMessage(result.message || '同期実行中です');
        if (est != null && est > 0) {
          setSyncProgressVisible(true);
          setSyncProgressTotal(est);
          setSyncProgressDone(0);
          setSyncProgressStartedAt(new Date().toISOString());
          setSyncProgressLastUpdatedAt(Date.now());
          setSyncProgressUnknownTotal(false);
        } else {
          // バックエンドが件数見積もりを返さない場合でも「同期中」であることを表示
          setSyncProgressVisible(true);
          setSyncProgressTotal(0);
          setSyncProgressDone(0);
          setSyncProgressStartedAt(null);
          setSyncProgressLastUpdatedAt(Date.now());
          setSyncProgressUnknownTotal(true);
        }
        message.success(
          est != null
            ? t('campaignsSyncAllQueuedWithInsights', { count: est })
            : t('campaignsSyncAllQueued'),
        );
        fetchCampaigns();
        window.setTimeout(() => void fetchCampaigns(), 5000);
        window.setTimeout(() => void fetchCampaigns(), 10000);
        window.setTimeout(() => void fetchCampaigns(), 15000);
      } else {
        setSyncAllTaskState('success');
        setSyncAllTaskMessage(result.message || t('campaignsSyncAllDone'));
        message.success(result.message || t('campaignsSyncAllDone'));
        fetchCampaigns();
      }
    } catch (error) {
      setSyncProgressVisible(false);
      setSyncProgressUnknownTotal(false);
      setSyncProgressStuck(false);
      setSyncAllTaskState('failure');
      setSyncAllTaskMessage(t('campaignsSyncAllFailed'));
      message.error(t('campaignsSyncAllFailed'));
      console.error('Failed to sync all campaigns:', error);
    } finally {
      setSyncAllLoading(false);
    }
  };

  // Meta API からキャンペーンをインポート
  const handleImportFromMeta = async () => {
    if (selectedMetaAccountIds.length === 0) {
      message.error('Meta アカウントを1つ以上選択してください');
      return;
    }

    setLoading(true);
    try {
      const result = await campaignService.importCampaignsFromMeta(selectedMetaAccountIds);
      
      message.success(result.message);
      setImportModalVisible(false);
      setSelectedMetaAccountIds([]);
      fetchCampaigns();
    } catch (error: any) {
      console.error('Failed to import campaigns:', error);
      const errorMessage = error.response?.data?.error || 'インポートに失敗しました';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // キャンペーン全体（キャンペーン+広告セット+広告）のMeta API同期
  const handleSyncCampaignFull = async (campaign: Campaign) => {
    try {
      const result = await campaignService.syncCampaignFullFromMeta(campaign.id);
      
      if (result.task_id) {
        message.loading(`キャンペーン「${campaign.name}」の全体同期中...`, 0);
        
        // 簡易的な完了待機
        setTimeout(() => {
          message.destroy();
          message.success(`キャンペーン「${campaign.name}」の全体同期が完了しました`);
          fetchCampaigns();
        }, 8000); // 広告セットと広告も含むため少し長め
      } else {
        message.success(result.message);
        fetchCampaigns();
      }
    } catch (error) {
      message.error('全体同期に失敗しました');
      console.error('Failed to sync campaign full:', error);
    }
  };

  // 一括操作: 有効化
  const handleBatchActivate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectCampaignsFirst'));
      return;
    }

    Modal.confirm({
      title: t('batchActivateConfirm'),
      content: `${selectedRowKeys.length}${t('batchActivateMessage')}`,
      okText: t('batchActivate'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          const promises = selectedRowKeys.map(id => 
            campaignService.activateCampaign(id as number)
          );
          await Promise.all(promises);
          message.success(`${selectedRowKeys.length}${t('batchActivateSuccess')}`);
          setSelectedRowKeys([]);
          fetchCampaigns();
        } catch (error) {
          message.error(t('batchActivateFailed'));
          console.error('Failed to batch activate campaigns:', error);
        }
      },
    });
  };

  // 一括操作: 一時停止
  const handleBatchPause = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectCampaignsFirst'));
      return;
    }

    Modal.confirm({
      title: t('batchPauseConfirm'),
      content: `${selectedRowKeys.length}${t('batchPauseMessage')}`,
      okText: t('batchPause'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          const promises = selectedRowKeys.map(id => 
            campaignService.pauseCampaign(id as number)
          );
          await Promise.all(promises);
          message.success(`${selectedRowKeys.length}${t('batchPauseSuccess')}`);
          setSelectedRowKeys([]);
          fetchCampaigns();
        } catch (error) {
          message.error(t('batchPauseFailed'));
          console.error('Failed to batch pause campaigns:', error);
        }
      },
    });
  };

  // 一括操作: 削除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectCampaignsFirst'));
      return;
    }

    Modal.confirm({
      title: t('batchDeleteConfirm'),
      content: `${selectedRowKeys.length}${t('batchDeleteMessage')}`,
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          const promises = selectedRowKeys.map(id => 
            campaignService.deleteCampaign(id as number)
          );
          await Promise.all(promises);
          message.success(`${selectedRowKeys.length}${t('batchDeleteSuccess')}`);
          setSelectedRowKeys([]);
          fetchCampaigns();
        } catch (error) {
          message.error(t('batchDeleteFailed'));
          console.error('Failed to batch delete campaigns:', error);
        }
      },
    });
  };

  const columns = [
    {
      title: t('campaignName'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'orange'}>
          {status === 'ACTIVE' ? t('active') : t('paused')}
        </Tag>
      ),
    },
    {
      title: t('objective'),
      dataIndex: 'objective',
      key: 'objective',
      width: 120,
      ellipsis: true,
      render: (objective: string) => {
        const objectiveMap: Record<string, string> = {
          OUTCOME_CONVERSIONS: t('conversions'),
          OUTCOME_TRAFFIC: t('traffic'),
          OUTCOME_AWARENESS: t('awareness'),
          OUTCOME_ENGAGEMENT: t('engagement'),
          OUTCOME_BRAND_AWARENESS: t('brandAwareness'),
          OUTCOME_REACH: t('reach'),
          OUTCOME_VIDEO_VIEWS: t('videoViews'),
          OUTCOME_LEAD_GENERATION: t('leadGeneration'),
          OUTCOME_SALES: t('sales'),
          OUTCOME_CATALOG_SALES: t('catalogSales'),
          OUTCOME_STORE_VISITS: t('storeVisits'),
          OUTCOME_APP_PROMOTION: t('appPromotion'),
          OUTCOME_APP_INSTALLS: t('appInstalls'),
          OUTCOME_MESSAGES: t('messages'),
          OUTCOME_MESSENGER_ENGAGEMENT: t('messengerEngagement'),
          OUTCOME_EVENT_RESPONSES: t('eventResponses'),
          OUTCOME_PAGE_LIKES: t('pageLikes'),
          OUTCOME_POST_ENGAGEMENT: t('postEngagement'),
        };
        return objectiveMap[objective] || objective;
      },
    },
    {
      title: t('budget'),
      dataIndex: 'budget',
      key: 'budget',
      width: 100,
      render: (value: number) => `¥${Math.floor(value).toLocaleString()}`,
    },
    {
      title: t('campaignSpend'),
      dataIndex: 'spend',
      key: 'spend',
      width: 110,
      render: (value: number | null | undefined) =>
        value == null || Number.isNaN(Number(value)) ? '—' : `¥${Math.floor(Number(value)).toLocaleString()}`,
    },
    {
      title: t('period'),
      key: 'period',
      width: 180,
      ellipsis: true,
      render: (record: Campaign) => {
        const start = dayjs(record.start_date).format('MM/DD');
        const end = record.end_date ? dayjs(record.end_date).format('MM/DD') : '-';
        return `${start} - ${end}`;
      },
    },
    {
      title: t('actions'),
      key: 'actions',
      width: 120,
      render: (record: Campaign) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<SyncOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleSyncCampaign(record);
            }}
            title="キャンペーン同期"
          />
          <Button
            type="text"
            size="small"
            icon={<SyncOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleSyncCampaignFull(record);
            }}
            title="全体同期（キャンペーン+広告セット+広告）"
            style={{ color: '#1890ff' }}
          />
          <Button
            type="text"
            size="small"
            icon={record.status === 'ACTIVE' ? <PauseOutlined /> : <PlayCircleOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(record);
            }}
            title={record.status === 'ACTIVE' ? '一時停止' : '有効化'}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(record);
            }}
            title="削除"
          />
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: Campaign) => ({
      disabled: false,
      name: record.name,
    }),
  };

  return (
    <div>
      {isDemoMode && (
        <Alert
          message="デモモード"
          description="現在はデモデータを表示しています。実際のキャンペーン配信機能は制限されています。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Card
        title={t('campaignManagement')}
        extra={
          <Space>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={() => setImportModalVisible(true)}
              title="Meta API からキャンペーンをインポート"
            >
              Meta からインポート
            </Button>
            <Button 
              icon={<SyncOutlined />} 
              onClick={() => void handleSyncAllCampaigns()}
              loading={syncAllLoading}
              disabled={syncAllLoading}
              title={t('campaignsSyncAllTooltip')}
            >
              {t('campaignsSyncAll')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              <span className="button-text">{t('newCampaign')}</span>
            </Button>
          </Space>
        }
        style={{ maxWidth: '100%' }}
      >
        {selectedRowKeys.length > 0 && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            backgroundColor: '#f0f8ff', 
            borderRadius: 6,
            border: '1px solid #d6e4ff'
          }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
              {selectedRowKeys.length}{t('selectedCampaigns')}
            </div>
            <Space wrap>
              <Button 
                size="small" 
                icon={<PlayCircleOutlined />}
                onClick={handleBatchActivate}
              >
                {t('batchActivate')}
              </Button>
              <Button 
                size="small" 
                icon={<PauseOutlined />}
                onClick={handleBatchPause}
              >
                {t('batchPause')}
              </Button>
              <Button 
                size="small" 
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                {t('batchDelete')}
              </Button>
              <Button 
                size="small" 
                onClick={() => setSelectedRowKeys([])}
              >
                {t('clearSelection')}
              </Button>
            </Space>
          </div>
        )}
        
        <div style={{ marginBottom: 16, color: '#666', fontSize: '14px' }}>
          💡 {t('tapToViewDetails')}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Switch checked={hideCampaignsWithoutSpend} onChange={setHideCampaignsWithoutSpend} />
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
            {t('campaignsHideNoSpend')}
          </Text>
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.45 }}>
              {t('campaignsHideNoSpendHint')}
            </Text>
          </div>
        </div>
        {syncProgressVisible && (
          <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
            {syncProgressUnknownTotal ? (
              <>
                <div style={{ marginBottom: 8, fontSize: 13 }}>同期実行中…（件数算出中）</div>
                <Progress percent={99} status="active" showInfo={false} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  同期ジョブは起動済みです。しばらく待ってから一覧を更新してください。
                </Text>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 13 }}>
                  同期進捗: {Math.min(syncProgressDone, syncProgressTotal)}/{syncProgressTotal} 件
                </div>
                <Progress
                  percent={Math.min(
                    100,
                    Math.round((Math.min(syncProgressDone, syncProgressTotal) / syncProgressTotal) * 100),
                  )}
                  status={syncProgressDone >= syncProgressTotal ? 'success' : 'active'}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  5秒ごとに自動更新しています（インサイト更新ベースの推定進捗）
                </Text>
              </>
            )}
            {syncProgressStuck && syncAllTaskState === 'pending' && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                message="5分以上進捗が動いていません（停滞の可能性）"
                description="celery / backend ログを確認してください。Meta APIトークン期限切れやワーカー停止で止まることがあります。"
              />
            )}
            {syncAllTaskMessage && (
              <div style={{ marginTop: 6 }}>
                <Text
                  type={syncAllTaskState === 'failure' ? 'danger' : 'secondary'}
                  style={{ fontSize: 12 }}
                >
                  実行結果: {syncAllTaskMessage}
                </Text>
              </div>
            )}
          </Card>
        )}
        {!loading && campaigns.length === 0 ? (
          <Table
            columns={columns}
            dataSource={[]}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1100 }}
            size="small"
            locale={{ emptyText: <Empty description={t('noData')} /> }}
          />
        ) : !loading && campaigns.length > 0 && campaignsVisibleInList.length === 0 ? (
          <Empty description={t('campaignsAllFilteredBySpend')} />
        ) : (
          <>
            <Spin spinning={loading}>
              <Collapse
                bordered
                activeKey={campaignListCollapseActiveKeys}
                onChange={(k: string | string[]) =>
                  setCampaignListCollapseActiveKeys(
                    Array.isArray(k) ? k : k != null ? [String(k)] : [],
                  )
                }
                style={{ background: '#fafafa', marginBottom: 16 }}
                items={campaignListGroups.map((g) => ({
                  key: g.key,
                  label: (
                    <span>
                      <strong>{g.title}</strong>
                      {g.subtitle ? (
                        <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{g.subtitle}</span>
                      ) : null}
                      <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>
                        ({g.accounts.length})
                      </span>
                    </span>
                  ),
                  children: (
                    <Table
                      columns={columns}
                      dataSource={g.accounts}
                      rowKey="id"
                      pagination={false}
                      scroll={{ x: 1100 }}
                      size="small"
                      rowSelection={rowSelection}
                      onRow={(record) => ({
                        onClick: () => handleRowClick(record),
                        style: {
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                        },
                        onMouseEnter: (e) => {
                          e.currentTarget.style.backgroundColor = '#f5f5f5';
                        },
                        onMouseLeave: (e) => {
                          e.currentTarget.style.backgroundColor = '';
                        },
                      })}
                    />
                  ),
                }))}
              />
            </Spin>
          </>
        )}
      </Card>

      <Modal
        title={editingCampaign ? t('editCampaign') : t('newCampaign')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            objective: 'CONVERSIONS',
            budget_type: 'DAILY',
          }}
        >
          <Form.Item
            name="name"
            label={t('campaignName')}
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <Input placeholder={t('enterCampaignName')} />
          </Form.Item>

          <Form.Item
            name="objective"
            label={t('objective')}
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <Select>
              <Option value="CONVERSIONS">{t('conversions')}</Option>
              <Option value="TRAFFIC">{t('traffic')}</Option>
              <Option value="AWARENESS">{t('awareness')}</Option>
              <Option value="ENGAGEMENT">{t('engagement')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="budget_type"
            label={t('budgetType')}
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <Select>
              <Option value="DAILY">{t('daily')}</Option>
              <Option value="LIFETIME">{t('lifetime')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="budget"
            label={t('budget')}
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => parseFloat(value!.replace(/¥\s?|(,*)/g, '')) as any}
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label={t('period')}
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              placeholder={[t('startDate'), t('endDate')]}
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                {t('cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {editingCampaign ? t('update') : t('create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* キャンペーン詳細モーダル */}
      <Modal
        title={t('campaignDetail')}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: 1200 }}
      >
        {selectedCampaign && (
          <div>
            {/* キャンペーン基本情報 */}
            <Card title="キャンペーン情報" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <h3>{selectedCampaign.name}</h3>
                <div style={{ marginBottom: 16 }}>
                  <Tag color={selectedCampaign.status === 'ACTIVE' ? 'green' : 'orange'}>
                    {selectedCampaign.status === 'ACTIVE' ? t('active') : t('paused')}
                  </Tag>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{t('purpose')}:</strong> {selectedCampaign.objective}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{t('budget')}:</strong> ¥{selectedCampaign.budget ? Math.floor(selectedCampaign.budget).toLocaleString() : '0'}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{t('campaignSpend')}:</strong>{' '}
                  {selectedCampaign.spend == null || Number.isNaN(Number(selectedCampaign.spend))
                    ? '—'
                    : `¥${Math.floor(Number(selectedCampaign.spend)).toLocaleString()}`}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{t('startDate')}:</strong> {dayjs(selectedCampaign.start_date).format('YYYY-MM-DD')}
                </div>
                {selectedCampaign.end_date && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>{t('endDate')}:</strong> {dayjs(selectedCampaign.end_date).format('YYYY-MM-DD')}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button 
                  type="primary" 
                  icon={<EditOutlined />} 
                  onClick={handleEditFromDetail}
                >
                  {t('edit')}
                </Button>
                <Button 
                  icon={selectedCampaign.status === 'ACTIVE' ? <PauseOutlined /> : <PlayCircleOutlined />} 
                  onClick={handleToggleStatusFromDetail}
                >
                  {selectedCampaign.status === 'ACTIVE' ? t('pause') : t('start')}
                </Button>
                <Button 
                  danger
                  icon={<DeleteOutlined />} 
                  onClick={handleDeleteFromDetail}
                >
                  {t('delete')}
                </Button>
              </div>
            </Card>

            {/* 広告セット一覧 */}
            <Card 
              title="広告セット" 
              style={{ marginBottom: 16 }}
              extra={
                <Button 
                  size="small" 
                  icon={<SyncOutlined />}
                  onClick={async () => {
                    if (selectedCampaign) {
                      try {
                        message.loading('Meta APIから同期中...', 0);
                        await campaignService.syncCampaignFullFromMeta(selectedCampaign.id);
                        message.destroy();
                        message.success('同期が完了しました');
                        
                        // データを再取得
                        const adsetsData = await adSetService.getAdSets(selectedCampaign.id);
                        const safeAdsetsData = Array.isArray(adsetsData) ? adsetsData : [];
                        
                        let allAds: Ad[] = [];
                        if (safeAdsetsData.length > 0) {
                          const adPromises = safeAdsetsData.map(adset => adService.getAds(adset.id));
                          const adResults = await Promise.all(adPromises);
                          allAds = adResults.flat().filter(ad => ad && typeof ad === 'object');
                        }
                        
                        setAdsets(safeAdsetsData);
                        setAds(allAds);
                      } catch (error) {
                        message.destroy();
                        message.error('同期に失敗しました');
                        console.error('Sync failed:', error);
                      }
                    }
                  }}
                >
                  同期
                </Button>
              }
            >
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: 20 }}>読み込み中...</div>
              ) : (
                <Table
                  dataSource={Array.isArray(adsets) ? adsets : []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '広告セットがありません' }}
                  columns={[
                    {
                      title: '広告セット名',
                      dataIndex: 'name',
                      key: 'name',
                      width: 200,
                    },
                    {
                      title: 'ステータス',
                      dataIndex: 'status',
                      key: 'status',
                      width: 120,
                      render: (status: string, record: AdSet) => (
                        <div>
                          <Tag color={status === 'ACTIVE' ? 'green' : 'orange'}>
                            {status === 'ACTIVE' ? '有効' : '一時停止'}
                          </Tag>
                          {record.adset_id && !record.adset_id.startsWith('adset_') && (
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                              Meta同期済み
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: '予算',
                      dataIndex: 'budget',
                      key: 'budget',
                      width: 120,
                      render: (budget: number) => budget ? `¥${Math.floor(budget).toLocaleString()}` : '-',
                    },
                    {
                      title: '入札戦略',
                      dataIndex: 'bid_strategy',
                      key: 'bid_strategy',
                      width: 150,
                    },
                    {
                      title: '操作',
                      key: 'actions',
                      width: 120,
                      render: (_, record: AdSet) => (
                        <Space size="small">
                          <Button
                            type="text"
                            size="small"
                            icon={record.status === 'ACTIVE' ? <PauseOutlined /> : <PlayCircleOutlined />}
                            onClick={() => handleToggleAdSetStatus(record)}
                            title={record.status === 'ACTIVE' ? '一時停止' : '有効化'}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              )}
            </Card>

            {/* 広告一覧 */}
            <Card title="広告">
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: 20 }}>読み込み中...</div>
              ) : (
                <Table
                  dataSource={Array.isArray(ads) ? ads : []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '広告がありません' }}
                  columns={[
                    {
                      title: '広告名',
                      dataIndex: 'name',
                      key: 'name',
                      width: 200,
                    },
                    {
                      title: 'ステータス',
                      dataIndex: 'status',
                      key: 'status',
                      width: 120,
                      render: (status: string, record: Ad) => (
                        <div>
                          <Tag color={status === 'ACTIVE' ? 'green' : 'orange'}>
                            {status === 'ACTIVE' ? '有効' : '一時停止'}
                          </Tag>
                          {record.ad_id && !record.ad_id.startsWith('ad_') && (
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                              Meta同期済み
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: '見出し',
                      dataIndex: 'headline',
                      key: 'headline',
                      width: 200,
                      ellipsis: true,
                    },
                    {
                      title: 'CTA',
                      dataIndex: 'cta_type',
                      key: 'cta_type',
                      width: 120,
                    },
                    {
                      title: '審査状況',
                      dataIndex: 'review_feedback',
                      key: 'review_feedback',
                      width: 120,
                      render: (review_feedback: any) => {
                        if (!review_feedback || !review_feedback.overall_status) {
                          return <Tag color="default">不明</Tag>;
                        }
                        
                        const status = review_feedback.overall_status;
                        const color = status === 'APPROVED' ? 'green' : 
                                    status === 'PENDING' ? 'orange' : 
                                    status === 'REJECTED' ? 'red' : 'default';
                        
                        const text = status === 'APPROVED' ? '承認済み' :
                                   status === 'PENDING' ? '審査中' :
                                   status === 'REJECTED' ? '却下' : status;
                        
                        return <Tag color={color}>{text}</Tag>;
                      },
                    },
                    {
                      title: '操作',
                      key: 'actions',
                      width: 120,
                      render: (_, record: Ad) => (
                        <Space size="small">
                          <Button
                            type="text"
                            size="small"
                            icon={record.status === 'ACTIVE' ? <PauseOutlined /> : <PlayCircleOutlined />}
                            onClick={() => handleToggleAdStatus(record)}
                            title={record.status === 'ACTIVE' ? '一時停止' : '有効化'}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* Meta からインポートモーダル */}
      <Modal
        title="Meta API からキャンペーンをインポート"
        open={importModalVisible}
        onOk={handleImportFromMeta}
        onCancel={() => {
          setImportModalVisible(false);
          setSelectedMetaAccountIds([]);
        }}
        okText="インポート"
        cancelText="キャンセル"
        confirmLoading={loading}
      >
        <p>
          インポートする <strong>Meta 広告アカウント</strong>にチェックを入れてください。
          チェックした<strong>それぞれのアカウント</strong>について、Meta 上のキャンペーンを取り込みます（アカウントを複数選べます）。
        </p>
        <Space style={{ marginBottom: 8 }}>
          <Button
            type="link"
            size="small"
            onClick={() => setSelectedMetaAccountIds(metaAccounts.map((a) => a.id))}
            disabled={metaAccounts.length === 0}
          >
            すべて選択
          </Button>
          <Button type="link" size="small" onClick={() => setSelectedMetaAccountIds([])}>
            クリア
          </Button>
        </Space>
        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
          <Checkbox.Group
            value={selectedMetaAccountIds}
            onChange={(list) => setSelectedMetaAccountIds(list as number[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {metaAccounts.map((account) => (
                <Checkbox key={account.id} value={account.id}>
                  {account.account_name} ({account.account_id})
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </div>
        {metaAccounts.length === 0 && (
          <Alert
            message="Meta アカウントが登録されていません"
            description="Settings ページで Meta アカウントを追加してください。"
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default Campaigns;