// src/screens/TravelLogScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Travel Log — Odoo Expense Entry
// Icons: @expo/vector-icons (Ionicons) — bundled with Expo, no install needed
// Theme: #3e7cb9 base
// Offline: queues writes via offlineSync when no connection is available
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { enqueueOdooOperation } from '../services/offlineSync';
import { getOdooEmployees, odooSession } from '../services/odoo';
import { getTravelSiteOptions, submitTravelLogToOdoo } from '../services/modules/travelLogModule';
import useNetworkStatus from '../hooks/useNetworkStatus';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  primary:      '#3e7cb9',
  primaryDark:  '#2d5f94',
  primaryLight: '#5a9fd4',
  primaryDim:   '#3e7cb918',
  primaryBorder:'#3e7cb940',
  bg:           '#080C12',
  surface:      '#0E1520',
  surfaceAlt:   '#111A28',
  border:       '#1A2535',
  borderLight:  '#243044',
  textPrimary:  '#FFFFFF',
  textSecondary:'#7A90A8',
  textMuted:    '#3A5068',
  offline:      '#E8A020',
  offlineDim:   '#E8A02018',
  offlineBorder:'#E8A02040',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const pad     = (n)  => String(n).padStart(2, '0');
const fmtDate = (d)  => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTime = (d)  => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const DAYS   = Array.from({ length: 31 }, (_, i) => pad(i + 1));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS  = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - 2 + i));
const HOURS  = Array.from({ length: 24 }, (_, i) => pad(i));
const MINS   = Array.from({ length: 60 }, (_, i) => pad(i));

const ITEM_H  = 46;
const VISIBLE = 5;

// ─── WheelColumn ──────────────────────────────────────────────────────────────

const WheelColumn = ({ items, selectedIndex, onChange, width }) => {
  const ref      = useRef(null);
  const didMount = useRef(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({ y: selectedIndex * ITEM_H, animated: didMount.current });
      didMount.current = true;
    }
  }, [selectedIndex]);

  const onMomentumEnd = useCallback((e) => {
    const idx     = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    onChange(clamped);
  }, [items, onChange]);

  const padCount = Math.floor(VISIBLE / 2);
  const padded   = [...Array(padCount).fill(''), ...items, ...Array(padCount).fill('')];

  return (
    <ScrollView
      ref={ref}
      style={{ width, height: ITEM_H * VISIBLE }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={onMomentumEnd}
      scrollEventThrottle={16}
    >
      {padded.map((item, i) => {
        const realIdx    = i - padCount;
        const isSelected = realIdx === selectedIndex;
        return (
          <View key={`${item}-${i}`} style={[wh.item, { height: ITEM_H }]}>
            <Text style={[wh.text, isSelected && wh.textSelected]}>{item}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

const wh = StyleSheet.create({
  item:         { justifyContent: 'center', alignItems: 'center' },
  text:         { fontSize: 17, color: C.textMuted, fontWeight: '500' },
  textSelected: { fontSize: 22, color: C.textPrimary, fontWeight: '700' },
});

// ─── DateTimePickerModal ──────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');

const DateTimePickerModal = ({ visible, mode, value, onConfirm, onCancel }) => {
  const [day,    setDay]    = useState(0);
  const [month,  setMonth]  = useState(0);
  const [year,   setYear]   = useState(0);
  const [hour,   setHour]   = useState(0);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (visible) {
      setDay(value.getDate() - 1);
      setMonth(value.getMonth());
      setYear(Math.max(0, YEARS.indexOf(String(value.getFullYear()))));
      setHour(value.getHours());
      setMinute(value.getMinutes());
    }
  }, [visible]);

  const handleConfirm = () => {
    const d = new Date(value);
    if (mode === 'date') {
      d.setFullYear(Number(YEARS[year]), month, Number(DAYS[day]));
    } else {
      d.setHours(hour, minute, 0, 0);
    }
    onConfirm(d);
  };

  const colW = mode === 'date' ? (SW - 80) / 3 : (SW - 80) / 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={onCancel} />
      <View style={pm.sheet}>
        <View style={pm.handle} />

        <View style={pm.modalHeader}>
          <Ionicons
            name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
            size={18}
            color={C.primary}
          />
          <Text style={pm.title}>{mode === 'date' ? 'Select Date' : 'Select Time'}</Text>
        </View>

        <View style={pm.wheelWrap}>
          <View style={[pm.selectionBar, { top: ITEM_H * Math.floor(VISIBLE / 2) }]} pointerEvents="none" />
          {mode === 'date' ? (
            <View style={pm.columns}>
              <WheelColumn items={DAYS}   selectedIndex={day}   onChange={setDay}   width={colW} />
              <View style={pm.sep} />
              <WheelColumn items={MONTHS} selectedIndex={month} onChange={setMonth} width={colW} />
              <View style={pm.sep} />
              <WheelColumn items={YEARS}  selectedIndex={year}  onChange={setYear}  width={colW} />
            </View>
          ) : (
            <View style={pm.columns}>
              <WheelColumn items={HOURS} selectedIndex={hour}   onChange={setHour}   width={colW} />
              <Text style={pm.colon}>:</Text>
              <WheelColumn items={MINS}  selectedIndex={minute} onChange={setMinute} width={colW} />
            </View>
          )}
        </View>

        <View style={pm.btnRow}>
          <TouchableOpacity style={pm.cancelBtn} onPress={onCancel}>
            <Text style={pm.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pm.confirmBtn} onPress={handleConfirm}>
            <LinearGradient colors={[C.primary, C.primaryDark]} style={pm.confirmGrad}>
              <Text style={pm.confirmText}>Confirm</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const pm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    borderTopWidth: 1, borderColor: C.border,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.borderLight, marginTop: 12, marginBottom: 18,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  title:       { fontSize: 16, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.3 },
  wheelWrap:   { position: 'relative', marginBottom: 22 },
  selectionBar: {
    position: 'absolute', left: 0, right: 0, height: ITEM_H,
    backgroundColor: C.surfaceAlt, borderRadius: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.primaryBorder,
  },
  columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sep:     { width: 8 },
  colon:   { fontSize: 28, fontWeight: '700', color: C.primary, paddingHorizontal: 6, marginBottom: 4 },
  btnRow:  { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    paddingVertical: 14, alignItems: 'center', backgroundColor: C.surfaceAlt,
  },
  cancelText:  { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  confirmBtn:  { flex: 1, borderRadius: 14, overflow: 'hidden' },
  confirmGrad: { paddingVertical: 14, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// ─── TravelLogScreen ──────────────────────────────────────────────────────────

const TravelLogScreen = ({ navigation }) => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable !== false;

  const [checkinDate,  setCheckinDate]  = useState(new Date());
  const [checkinTime,  setCheckinTime]  = useState(new Date());
  const [checkoutDate, setCheckoutDate] = useState(new Date());
  const [checkoutTime, setCheckoutTime] = useState(new Date());
  const [siteFrom,     setSiteFrom]     = useState('');
  const [siteTo,       setSiteTo]       = useState('');
  const [siteFromId,   setSiteFromId]   = useState(null);
  const [siteToId,     setSiteToId]     = useState(null);
  const [kilometres,   setKilometres]   = useState('');
  const [whoseClaim,   setWhoseClaim]   = useState('');
  const [whoseClaimId, setWhoseClaimId] = useState(null);
  const [transport,    setTransport]    = useState(null);
  const [teamOnSite,   setTeamOnSite]   = useState([]);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode,    setPickerMode]    = useState('date');
  const [pickerTarget,  setPickerTarget]  = useState(null);
  const [pickerValue,   setPickerValue]   = useState(new Date());

  const [allUsers,     setAllUsers]     = useState([]);
  const [siteOptions,  setSiteOptions]  = useState([]);
  const [activeSiteDropdown, setActiveSiteDropdown] = useState(null);
  const [userSearch,   setUserSearch]   = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showClaimDropdown, setShowClaimDropdown] = useState(false);
  const [saving,       setSaving]       = useState(false);

  const mergeUsers = (current, incoming) => {
    const byId = new Map(current.map((user) => [user.uid, user]));
    incoming.forEach((user) => byId.set(user.uid, user));
    return [...byId.values()].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  };

  const mergeSites = (current, incoming) => {
    const byKey = new Map(current.map((site) => [`${site.model}-${site.id}`, site]));
    incoming.forEach((site) => byKey.set(`${site.model}-${site.id}`, site));
    return [...byKey.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  const loadOdooUsers = useCallback(async (search = '', limit = 50) => {
    try {
      const users = await getOdooEmployees(search, limit);
      const mapped = users.map((user) => ({
        uid: user.id,
        id: user.id,
        fullName: user.name,
        email: user.work_email || (Array.isArray(user.user_id) ? user.user_id[1] : ''),
      }));
      setAllUsers((current) => mergeUsers(current, mapped));
      return mapped;
    } catch (e) {
      console.warn('Could not load Odoo users:', e.message);
      return [];
    }
  }, []);

  const loadTravelSites = useCallback(async (search = '', limit = 100) => {
    try {
      const sites = await getTravelSiteOptions(search, limit);
      setSiteOptions((current) => mergeSites(current, sites));
      return sites;
    } catch (e) {
      console.warn('Could not load Odoo travel sites:', e.message);
      return [];
    }
  }, []);

  useEffect(() => {
    loadOdooUsers('', 50);
  }, [loadOdooUsers]);

  useEffect(() => {
    loadTravelSites('', 100);
  }, [loadTravelSites]);

  useEffect(() => {
    const q = userSearch.trim();
    if (!online || q.length < 2) return undefined;

    const timer = setTimeout(() => {
      loadOdooUsers(q, 25);
    }, 300);

    return () => clearTimeout(timer);
  }, [loadOdooUsers, online, userSearch]);

  useEffect(() => {
    const q = whoseClaim.trim();
    if (!online || q.length < 2) return undefined;

    const timer = setTimeout(() => {
      loadOdooUsers(q, 25);
    }, 300);

    return () => clearTimeout(timer);
  }, [loadOdooUsers, online, whoseClaim]);

  useEffect(() => {
    const q = activeSiteDropdown === 'from' ? siteFrom.trim() : siteTo.trim();
    if (!online || q.length < 2) return undefined;

    const timer = setTimeout(() => {
      loadTravelSites(q, 25);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeSiteDropdown, loadTravelSites, online, siteFrom, siteTo]);

  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch.trim()) return false;
    const q = userSearch.toLowerCase();
    return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const filteredClaimUsers = allUsers.filter((u) => {
    if (!whoseClaim.trim()) return false;
    const q = whoseClaim.toLowerCase();
    return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const filteredSites = (value) => {
    const q = value.trim().toLowerCase();
    if (!q) return siteOptions.slice(0, 8);
    return siteOptions
      .filter((site) => site.name?.toLowerCase().includes(q))
      .slice(0, 8);
  };

  const openPicker = (target, mode, currentValue) => {
    setPickerTarget(target);
    setPickerMode(mode);
    setPickerValue(currentValue);
    setPickerVisible(true);
  };

  const onPickerConfirm = (date) => {
    setPickerVisible(false);
    if (pickerTarget === 'checkin-date')   setCheckinDate(date);
    if (pickerTarget === 'checkin-time')   setCheckinTime(date);
    if (pickerTarget === 'checkout-date')  setCheckoutDate(date);
    if (pickerTarget === 'checkout-time')  setCheckoutTime(date);
  };

  const toggleUser = (user) => {
    setTeamOnSite((prev) =>
      prev.find((u) => u.uid === user.uid)
        ? prev.filter((u) => u.uid !== user.uid)
        : [...prev, user]
    );
    setUserSearch('');
    setShowDropdown(false);
  };

  const removeTeamMember = (uid) =>
    setTeamOnSite((prev) => prev.filter((u) => u.uid !== uid));

  const showSuccessAlert = (wasQueued) => {
    const title   = wasQueued ? 'Saved Offline' : 'Travel Log Submitted';
    const message = wasQueued
      ? 'No internet connection — your travel log has been saved locally and will sync to Odoo automatically when you\'re back online.\n\n📸 Don\'t forget to send your screenshots via WhatsApp!'
      : 'Your travel log has been saved successfully. Don\'t forget to send your screenshots via WhatsApp!';

    Alert.alert(title, message, [
      {
        text: 'Take me there',
        onPress: () => {
          navigation?.goBack();
          Linking.openURL('whatsapp://').catch(() =>
            Linking.openURL('https://wa.me').catch(() =>
              Alert.alert('WhatsApp not found', 'Please make sure WhatsApp is installed on your device.')
            )
          );
        },
      },
      {
        text: 'OK',
        style: 'cancel',
        onPress: () => navigation?.goBack(),
      },
    ]);
  };

  const handleSave = async () => {
    if (!siteFrom.trim() || !siteTo.trim()) {
      Alert.alert('Missing fields', 'Please fill in Site From and Site To.');
      return;
    }
    if (!transport) {
      Alert.alert('Missing fields', 'Please select a transport type.');
      return;
    }
    if (!kilometres.trim() || isNaN(Number(kilometres))) {
      Alert.alert('Invalid', 'Please enter a valid distance in KM.');
      return;
    }

    try {
      setSaving(true);
      await odooSession.load();

      const checkinDT  = new Date(checkinDate);
      checkinDT.setHours(checkinTime.getHours(), checkinTime.getMinutes(), 0, 0);
      const checkoutDT = new Date(checkoutDate);
      checkoutDT.setHours(checkoutTime.getHours(), checkoutTime.getMinutes(), 0, 0);

      const payload = {
        checkin:         checkinDT.toISOString(),
        checkout:        checkoutDT.toISOString(),
        siteFrom:        siteFrom.trim(),
        siteTo:          siteTo.trim(),
        siteFromId,
        siteToId,
        kilometres:      Number(kilometres),
        whoseClaim:      whoseClaim.trim() || odooSession.userInfo?.name || '',
        whoseClaimId,
        transport,
        teamOnSite:      teamOnSite.map((u) => ({ uid: u.uid, id: u.id, fullName: u.fullName, email: u.email })),
        submittedBy:     odooSession.uid || null,
        submittedByName: odooSession.userInfo?.name || '',
      };

      if (online) {
        // ── Online: write directly to Firestore ──────────────────────────────
        await submitTravelLogToOdoo(payload);
        showSuccessAlert(false);
      } else {
        // ── Offline: queue for later sync ────────────────────────────────────
        // serverTimestamp() cannot be serialised to AsyncStorage — use ISO string.
        // offlineSync will write it as a plain string; the Odoo sync layer can
        // normalise this. Alternatively, update offlineSync to convert it on flush.
        await enqueueOdooOperation('travel.log.submit', {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        showSuccessAlert(true);
      }
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to save travel log.');
    } finally {
      setSaving(false);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[C.bg, '#0A1220', C.bg]} style={s.flex}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="chevron-back" size={20} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Travel Log</Text>
            <Text style={s.headerSub}>Odoo Expense Entry</Text>
          </View>
          <View style={s.headerBadge}>
            <Ionicons name="sync-outline" size={12} color={C.primary} />
            <Text style={s.headerBadgeText}>ODOO</Text>
          </View>
        </View>

        {/* ── Offline banner ── */}
        {!online && (
          <View style={s.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={15} color={C.offline} />
            <Text style={s.offlineBannerText}>
              You're offline — your log will sync automatically when reconnected
            </Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── CHECK-IN ── */}
          <SectionLabel iconName="log-in-outline" label="Check-in" />
          <View style={s.row}>
            <DateField label="Date" value={fmtDate(checkinDate)} iconName="calendar-outline"
              onPress={() => openPicker('checkin-date', 'date', checkinDate)} flex={1} />
            <View style={s.rowGap} />
            <DateField label="Time" value={fmtTime(checkinTime)} iconName="time-outline"
              onPress={() => openPicker('checkin-time', 'time', checkinTime)} flex={1} />
          </View>

          {/* ── CHECK-OUT ── */}
          <SectionLabel iconName="log-out-outline" label="Check-out" />
          <View style={s.row}>
            <DateField label="Date" value={fmtDate(checkoutDate)} iconName="calendar-outline"
              onPress={() => openPicker('checkout-date', 'date', checkoutDate)} flex={1} />
            <View style={s.rowGap} />
            <DateField label="Time" value={fmtTime(checkoutTime)} iconName="time-outline"
              onPress={() => openPicker('checkout-time', 'time', checkoutTime)} flex={1} />
          </View>

          {/* ── ROUTE ── */}
          <SectionLabel iconName="map-outline" label="Route" />
          <View style={s.row}>
            <SiteField
              label="Site From"
              value={siteFrom}
              onChangeText={(text) => {
                setSiteFrom(text);
                setSiteFromId(null);
              }}
              placeholder="Departure site"
              iconName="location-outline"
              flex={1}
              active={activeSiteDropdown === 'from'}
              onFocus={() => setActiveSiteDropdown('from')}
              onSelect={(site) => {
                setSiteFrom(site.name);
                setSiteFromId(site.id);
                setActiveSiteDropdown(null);
              }}
              sites={filteredSites(siteFrom)}
            />
            <View style={s.routeArrowWrap}>
              <Ionicons name="arrow-forward" size={18} color={C.primary} />
            </View>
            <SiteField
              label="Site To"
              value={siteTo}
              onChangeText={(text) => {
                setSiteTo(text);
                setSiteToId(null);
              }}
              placeholder="Arrival site"
              iconName="flag-outline"
              flex={1}
              active={activeSiteDropdown === 'to'}
              onFocus={() => setActiveSiteDropdown('to')}
              onSelect={(site) => {
                setSiteTo(site.name);
                setSiteToId(site.id);
                setActiveSiteDropdown(null);
              }}
              sites={filteredSites(siteTo)}
            />
          </View>
          <InputField label="Distance (KM)" value={kilometres} onChangeText={setKilometres}
            placeholder="e.g. 45" iconName="speedometer-outline" keyboardType="numeric" />

          {/* ── CLAIM ── */}
          <SectionLabel iconName="receipt-outline" label="Claim Details" />
          <View style={s.searchWrap}>
            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Whose Claim</Text>
              <View style={s.iconInput}>
                <Ionicons name="person-outline" size={16} color={C.textMuted} style={s.iconInputIcon} />
                <TextInput
                  style={s.iconInputText}
                  value={whoseClaim}
                  onChangeText={(text) => {
                    setWhoseClaim(text);
                    setWhoseClaimId(null);
                    setShowClaimDropdown(true);
                  }}
                  onFocus={() => setShowClaimDropdown(true)}
                  placeholder="Name of the claimant"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            {showClaimDropdown && filteredClaimUsers.length > 0 && (
              <View style={s.dropdown}>
                {filteredClaimUsers.slice(0, 6).map((u) => (
                  <TouchableOpacity
                    key={`claim-${u.uid}`}
                    style={s.dropdownItem}
                    onPress={() => {
                      setWhoseClaim(u.fullName || '');
                      setWhoseClaimId(u.id);
                      setShowClaimDropdown(false);
                    }}
                  >
                    <View style={s.dropdownAvatar}>
                      <Text style={s.dropdownAvatarText}>{u.fullName?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={s.dropdownInfo}>
                      <Text style={s.dropdownName}>{u.fullName}</Text>
                      <Text style={s.dropdownEmail}>{u.email}</Text>
                    </View>
                    <Ionicons name="checkmark-circle-outline" size={20} color={C.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── TRANSPORT ── */}
          <SectionLabel iconName="car-sport-outline" label="Transport" />
          <View style={s.row}>
            <TransportBtn label="Company Car" iconName="business-outline" active={transport === 'company'} onPress={() => setTransport('company')} />
            <View style={s.rowGap} />
            <TransportBtn label="My Car" iconName="car-outline" active={transport === 'my'} onPress={() => setTransport('my')} />
          </View>

          {/* ── TEAM ON SITE ── */}
          <SectionLabel iconName="people-outline" label="Team on Site" />

          {teamOnSite.length > 0 && (
            <View style={s.chips}>
              {teamOnSite.map((u) => (
                <TouchableOpacity key={u.uid} style={s.chip} onPress={() => removeTeamMember(u.uid)}>
                  <Ionicons name="person" size={11} color={C.primaryLight} />
                  <Text style={s.chipText}>{u.fullName}</Text>
                  <Ionicons name="close" size={12} color={C.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.searchWrap}>
            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>Search team member</Text>
              <View style={s.iconInput}>
                <Ionicons name="search-outline" size={16} color={C.textMuted} style={s.iconInputIcon} />
                <TextInput
                  style={s.iconInputText}
                  value={userSearch}
                  onChangeText={(t) => { setUserSearch(t); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type name or email…"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            {showDropdown && filteredUsers.length > 0 && (
              <View style={s.dropdown}>
                {filteredUsers.slice(0, 6).map((u) => {
                  const selected = teamOnSite.find((x) => x.uid === u.uid);
                  return (
                    <TouchableOpacity
                      key={u.uid}
                      style={[s.dropdownItem, selected && s.dropdownItemSelected]}
                      onPress={() => toggleUser(u)}
                    >
                      <View style={s.dropdownAvatar}>
                        <Text style={s.dropdownAvatarText}>{u.fullName?.[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <View style={s.dropdownInfo}>
                        <Text style={s.dropdownName}>{u.fullName}</Text>
                        <Text style={s.dropdownEmail}>{u.email}</Text>
                      </View>
                      {selected
                        ? <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                        : <Ionicons name="add-circle-outline" size={20} color={C.textMuted} />
                      }
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── SUBMIT ── */}
          <TouchableOpacity
            style={[s.submitBtn, saving && s.submitBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <LinearGradient
              colors={online ? [C.primary, C.primaryDark] : [C.offline, '#b07818']}
              style={s.submitGradient}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={s.submitInner}>
                  <Ionicons
                    name={online ? 'cloud-upload-outline' : 'save-outline'}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={s.submitText}>
                    {online ? 'Submit Travel Log' : 'Save Offline'}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>

      <DateTimePickerModal
        visible={pickerVisible}
        mode={pickerMode}
        value={pickerValue}
        onConfirm={onPickerConfirm}
        onCancel={() => setPickerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionLabel = ({ iconName, label }) => (
  <View style={s.sectionLabel}>
    <View style={s.sectionIconWrap}>
      <Ionicons name={iconName} size={14} color={C.primary} />
    </View>
    <Text style={s.sectionText}>{label}</Text>
    <View style={s.sectionLine} />
  </View>
);

const InputField = ({ label, flex, iconName, ...props }) => (
  <View style={[s.inputContainer, flex && { flex }]}>
    <Text style={s.inputLabel}>{label}</Text>
    <View style={s.iconInput}>
      {iconName && <Ionicons name={iconName} size={16} color={C.textMuted} style={s.iconInputIcon} />}
      <TextInput style={s.iconInputText} placeholderTextColor={C.textMuted} {...props} />
    </View>
  </View>
);

const SiteField = ({
  label,
  flex,
  iconName,
  value,
  onChangeText,
  placeholder,
  active,
  onFocus,
  onSelect,
  sites,
}) => (
  <View style={[s.inputContainer, s.siteInputContainer, flex && { flex }]}>
    <Text style={s.inputLabel}>{label}</Text>
    <View style={s.iconInput}>
      {iconName && <Ionicons name={iconName} size={16} color={C.textMuted} style={s.iconInputIcon} />}
      <TextInput
        style={s.iconInputText}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          onFocus();
        }}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
      />
    </View>
    {active && sites.length > 0 && (
      <View style={s.siteDropdown}>
        {sites.map((site) => (
          <TouchableOpacity key={`${site.model}-${site.id}`} style={s.siteDropdownItem} onPress={() => onSelect(site)}>
            <Ionicons name="business-outline" size={14} color={C.primary} />
            <Text style={s.siteDropdownText} numberOfLines={1}>{site.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
);

const DateField = ({ label, value, iconName, onPress, flex }) => (
  <TouchableOpacity style={[s.inputContainer, flex && { flex }]} onPress={onPress}>
    <Text style={s.inputLabel}>{label}</Text>
    <View style={s.iconInput}>
      <Ionicons name={iconName} size={16} color={C.textMuted} style={s.iconInputIcon} />
      <Text style={[s.iconInputText, { color: C.textPrimary, paddingVertical: 0, lineHeight: 46 }]} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="chevron-down" size={14} color={C.textMuted} style={{ marginRight: 4 }} />
    </View>
  </TouchableOpacity>
);

const TransportBtn = ({ label, iconName, active, onPress }) => (
  <TouchableOpacity
    style={[s.transportBtn, active && s.transportBtnActive, { flex: 1 }]}
    onPress={onPress}
  >
    {active && (
      <LinearGradient colors={[C.primaryDim, `${C.primary}22`]} style={StyleSheet.absoluteFill} />
    )}
    <View style={[s.transportIconCircle, active && s.transportIconCircleActive]}>
      <Ionicons name={iconName} size={22} color={active ? C.primary : C.textMuted} />
    </View>
    <Text style={[s.transportLabel, active && s.transportLabelActive]}>{label}</Text>
    {active && (
      <View style={s.transportCheck}>
        <Ionicons name="checkmark" size={11} color="#FFF" />
      </View>
    )}
  </TouchableOpacity>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 19, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  headerSub:    { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${C.primary}18`, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.primaryBorder,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 1 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.offlineDim,
    borderBottomWidth: 1, borderBottomColor: C.offlineBorder,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  offlineBannerText: { flex: 1, fontSize: 12, color: C.offline, lineHeight: 17 },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },

  // Section labels
  sectionLabel:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2 },
  sectionIconWrap: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: `${C.primary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionText: { fontSize: 12, fontWeight: '700', color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  // Inputs
  inputContainer: { marginBottom: 4 },
  inputLabel: {
    fontSize: 11, fontWeight: '600', color: C.textSecondary,
    marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  iconInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    minHeight: 46,
  },
  iconInputIcon: { marginLeft: 12, marginRight: 2 },
  iconInputText: {
    flex: 1, color: C.textPrimary, fontSize: 15,
    paddingHorizontal: 8, paddingVertical: 12,
  },
  siteInputContainer: { position: 'relative', zIndex: 20 },
  siteDropdown: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 14,
  },
  siteDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  siteDropdownText: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '600' },

  // Row layout
  row:            { flexDirection: 'row', alignItems: 'flex-start' },
  rowGap:         { width: 10 },
  routeArrowWrap: { paddingTop: 30, paddingHorizontal: 4 },

  // Transport
  transportBtn: {
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    gap: 8, overflow: 'hidden', position: 'relative',
  },
  transportBtnActive:   { borderColor: C.primary },
  transportIconCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  transportIconCircleActive: { backgroundColor: `${C.primary}18` },
  transportLabel:       { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  transportLabelActive: { color: C.textPrimary },
  transportCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  // Team / search
  searchWrap: { position: 'relative', zIndex: 10 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${C.primary}18`, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    gap: 5, borderWidth: 1, borderColor: C.primaryBorder,
  },
  chipText: { fontSize: 13, color: C.primaryLight, fontWeight: '600' },

  dropdown: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.borderLight,
    overflow: 'hidden', marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 11, gap: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownItemSelected: { backgroundColor: `${C.primary}10` },
  dropdownAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: `${C.primary}20`,
    justifyContent: 'center', alignItems: 'center',
  },
  dropdownAvatarText: { fontSize: 14, fontWeight: '700', color: C.primary },
  dropdownInfo:       { flex: 1 },
  dropdownName:       { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  dropdownEmail:      { fontSize: 12, color: C.textSecondary, marginTop: 1 },

  // Submit
  submitBtn:         { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.6 },
  submitGradient:    { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitInner:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText:        { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
});

export default TravelLogScreen;
