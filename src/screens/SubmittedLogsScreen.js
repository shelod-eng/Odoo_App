import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getQueue } from '../services/offlineSync';
import { getMyTravelLogs, toSubmittedLogCard } from '../services/modules/travelLogModule';
import useNetworkStatus from '../hooks/useNetworkStatus';

const C = {
  primary: '#3e7cb9',
  bg: '#080C12',
  surface: '#0E1520',
  surfaceAlt: '#111A28',
  border: '#1A2535',
  textPrimary: '#FFFFFF',
  textSecondary: '#7A90A8',
  textMuted: '#3A5068',
  offline: '#E8A020',
  offlineDim: '#E8A02015',
  offlineBorder: '#E8A02040',
  success: '#22C55E',
  successDim: '#22C55E15',
  successBorder: '#22C55E40',
};

const pad = (n) => String(n).padStart(2, '0');

const fmtDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const transportLabel = (value) =>
  value === 'company' ? 'Company Vehicle' : value === 'my' ? 'My Vehicle' : '--';

const InfoPill = ({ icon, value }) => (
  <View style={styles.pill}>
    <Ionicons name={icon} size={11} color={C.primary} />
    <Text style={styles.pillText}>{value}</Text>
  </View>
);

const LogCard = ({ log, queued }) => {
  const statusColor = queued ? C.offline : C.success;
  const statusDim = queued ? C.offlineDim : C.successDim;
  const borderColor = queued ? C.offlineBorder : C.successBorder;

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.statusBadge, { backgroundColor: statusDim, borderColor }]}>
            <Ionicons name={queued ? 'time-outline' : 'checkmark-circle-outline'} size={12} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {queued ? 'PENDING ODOO SYNC' : log.expenseStatus || log.status || 'ODOO SUBMITTED'}
            </Text>
          </View>
          {log.odooId ? <Text style={styles.reference}>#{log.odooId}</Text> : null}
        </View>

        <View style={styles.routeRow}>
          <Text style={styles.routeText} numberOfLines={1}>{log.siteFrom || '--'}</Text>
          <Ionicons name="arrow-forward" size={15} color={C.textMuted} />
          <Text style={styles.routeText} numberOfLines={1}>{log.siteTo || '--'}</Text>
        </View>

        <View style={styles.summaryRow}>
          <InfoPill icon="speedometer-outline" value={`${log.kilometres ?? '--'} km`} />
          <InfoPill icon="car-outline" value={transportLabel(log.transport)} />
          <InfoPill icon="person-outline" value={log.whoseClaim || '--'} />
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>In: {fmtDateTime(log.checkin)}</Text>
          <Text style={styles.detailText}>Out: {fmtDateTime(log.checkout)}</Text>
        </View>

        {queued ? (
          <Text style={styles.queueNote}>
            Saved locally. It will create the Odoo travel log and expense when the device reconnects.
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const SectionHeader = ({ label, count, color }) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionText, { color }]}>{label}</Text>
    <View style={[styles.sectionCount, { borderColor: `${color}55` }]}>
      <Text style={[styles.sectionCountText, { color }]}>{count}</Text>
    </View>
    <View style={[styles.sectionLine, { backgroundColor: `${color}33` }]} />
  </View>
);

const SubmittedLogsScreen = ({ navigation }) => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable !== false;

  const [submittedLogs, setSubmittedLogs] = useState([]);
  const [queuedLogs, setQueuedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const queue = await getQueue();
      setQueuedLogs(
        queue
          .filter((op) => op.operation === 'travel.log.submit')
          .map((op) => ({ ...op.payload, queueId: op.id }))
      );
    } catch (error) {
      console.warn('Could not read Odoo queue:', error.message);
      setQueuedLogs([]);
    }

    if (!online) {
      setSubmittedLogs([]);
      return;
    }

    try {
      const logs = await getMyTravelLogs(50);
      setSubmittedLogs(logs.map(toSubmittedLogCard));
    } catch (error) {
      console.warn('Could not load Odoo travel logs:', error.message);
      setSubmittedLogs([]);
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalCount = submittedLogs.length + queuedLogs.length;

  return (
    <View style={styles.flex}>
      <LinearGradient colors={[C.bg, '#0A1220', C.bg]} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="chevron-back" size={20} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Submitted Logs</Text>
            <Text style={styles.headerSub}>Odoo travel and expense records</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="layers-outline" size={12} color={C.primary} />
            <Text style={styles.headerBadgeText}>{totalCount}</Text>
          </View>
        </View>

        {!online ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={15} color={C.offline} />
            <Text style={styles.offlineBannerText}>Offline. Showing locally queued Odoo work only.</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Loading Odoo logs...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
            showsVerticalScrollIndicator={false}
          >
            {queuedLogs.length ? (
              <View>
                <SectionHeader label="Pending Odoo Sync" count={queuedLogs.length} color={C.offline} />
                {queuedLogs.map((log) => <LogCard key={log.queueId || log.createdAt} log={log} queued />)}
              </View>
            ) : null}

            <SectionHeader label="Submitted in Odoo" count={submittedLogs.length} color={C.success} />
            {submittedLogs.length ? (
              submittedLogs.map((log) => <LogCard key={log.id} log={log} />)
            ) : (
              <View style={styles.empty}>
                <Ionicons name="document-outline" size={28} color={C.textMuted} />
                <Text style={styles.emptyText}>
                  {online ? 'No Odoo travel logs found yet.' : 'Reconnect to load Odoo travel history.'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: C.textPrimary },
  headerSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3e7cb918',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#3e7cb940',
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: C.primary },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.offlineDim,
    borderBottomWidth: 1,
    borderBottomColor: C.offlineBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offlineBannerText: { flex: 1, fontSize: 12, color: C.offline },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: C.textSecondary },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 44 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionCount: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCountText: { fontSize: 11, fontWeight: '800' },
  sectionLine: { flex: 1, height: 1 },
  card: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  statusStrip: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  reference: { fontSize: 11, color: C.textMuted, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeText: { flex: 1, fontSize: 14, color: C.textPrimary, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  pillText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailText: { fontSize: 12, color: C.textSecondary },
  queueNote: { fontSize: 12, color: C.offline, lineHeight: 17 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
});

export default SubmittedLogsScreen;
