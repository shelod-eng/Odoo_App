// src/screens/JobReportScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Job Report — writes to Firestore 'jobReports' (Timesheet)
// Pulls tasks assigned to current user from 'tasks' collection
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
import {
  db, auth, collection, addDoc, serverTimestamp,
} from '../services/firebase';
import {
  getDocs, query, orderBy, where,
} from 'firebase/firestore';
import { enqueueOperation } from '../services/offlineSync';
import useNetworkStatus from '../hooks/useNetworkStatus';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  primary:      '#3e7cb9',
  primaryDark:  '#2d5f94',
  primaryLight: '#5a9fd4',
  primaryBorder:'#3e7cb940',
  primaryDim:   '#3e7cb918',
  bg:           '#080C12',
  surface:      '#0E1520',
  surfaceAlt:   '#111A28',
  border:       '#1A2535',
  borderLight:  '#243044',
  textPrimary:  '#FFFFFF',
  textSecondary:'#7A90A8',
  textMuted:    '#3A5068',
  offline:      '#E8A020',
  offlineDim:   '#E8A02015',
  offlineBorder:'#E8A02040',
  success:      '#22C55E',
  successDim:   '#22C55E15',
  successBorder:'#22C55E40',
  warn:         '#F59E0B',
  warnDim:      '#F59E0B15',
  warnBorder:   '#F59E0B40',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad     = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const DAYS   = Array.from({ length: 31 }, (_, i) => pad(i + 1));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS  = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - 2 + i));
const HOURS  = Array.from({ length: 24 }, (_, i) => pad(i));
const MINS   = Array.from({ length: 60 }, (_, i) => pad(i));
const ITEM_H  = 46;
const VISIBLE = 5;
const { width: SW } = Dimensions.get('window');

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
    <ScrollView ref={ref} style={{ width, height: ITEM_H * VISIBLE }}
      showsVerticalScrollIndicator={false} snapToInterval={ITEM_H}
      decelerationRate="fast" onMomentumScrollEnd={onMomentumEnd} scrollEventThrottle={16}>
      {padded.map((item, i) => {
        const isSelected = (i - padCount) === selectedIndex;
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

const DateTimePickerModal = ({ visible, mode, value, onConfirm, onCancel }) => {
  const [day, setDay]       = useState(0);
  const [month, setMonth]   = useState(0);
  const [year, setYear]     = useState(0);
  const [hour, setHour]     = useState(0);
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
    if (mode === 'date') d.setFullYear(Number(YEARS[year]), month, Number(DAYS[day]));
    else d.setHours(hour, minute, 0, 0);
    onConfirm(d);
  };
  const colW = mode === 'date' ? (SW - 80) / 3 : (SW - 80) / 2;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={onCancel} />
      <View style={pm.sheet}>
        <View style={pm.handle} />
        <View style={pm.modalHeader}>
          <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color={C.primary} />
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
    backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingHorizontal: 20,
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

const InputField = ({ label, flex, iconName, multiline, ...props }) => (
  <View style={[s.inputContainer, flex && { flex }]}>
    <Text style={s.inputLabel}>{label}</Text>
    <View style={[s.iconInput, multiline && s.iconInputMulti]}>
      {iconName && <Ionicons name={iconName} size={16} color={C.textMuted} style={multiline ? s.iconInputIconTop : s.iconInputIcon} />}
      <TextInput
        style={[s.iconInputText, multiline && s.iconInputTextMulti]}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
    </View>
  </View>
);

const DateField = ({ label, value, iconName, onPress, flex }) => (
  <TouchableOpacity style={[s.inputContainer, flex && { flex }]} onPress={onPress}>
    <Text style={s.inputLabel}>{label}</Text>
    <View style={s.iconInput}>
      <Ionicons name={iconName} size={16} color={C.textMuted} style={s.iconInputIcon} />
      <Text style={[s.iconInputText, { color: C.textPrimary, paddingVertical: 0, lineHeight: 46 }]} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-down" size={14} color={C.textMuted} style={{ marginRight: 4 }} />
    </View>
  </TouchableOpacity>
);

// ─── JobReportScreen ──────────────────────────────────────────────────────────

const JobReportScreen = ({ navigation }) => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable !== false;

  // Form fields
  const [projectName,           setProjectName]           = useState('');
  const [scope,                 setScope]                 = useState('');
  const [tasksFromPrevSelected, setTasksFromPrevSelected] = useState([]); // selected task IDs
  const [teamOnSite,            setTeamOnSite]            = useState([]);
  const [arrivedDate,           setArrivedDate]           = useState(new Date());
  const [arrivedTime,           setArrivedTime]           = useState(new Date());
  const [completedTasks,        setCompletedTasks]        = useState('');
  const [commentsCompleted,     setCommentsCompleted]     = useState('');
  const [outstandingTasks,      setOutstandingTasks]      = useState('');
  const [commentsOutstanding,   setCommentsOutstanding]   = useState('');
  const [requiredNextAction,    setRequiredNextAction]    = useState('');
  const [nextActionDate,        setNextActionDate]        = useState(new Date());
  const [timeCompleted,         setTimeCompleted]         = useState(new Date());
  const [handoverContact,       setHandoverContact]       = useState('');

  // Picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode,    setPickerMode]    = useState('date');
  const [pickerTarget,  setPickerTarget]  = useState(null);
  const [pickerValue,   setPickerValue]   = useState(new Date());

  // Data
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [allUsers,      setAllUsers]      = useState([]);
  const [userSearch,    setUserSearch]    = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    // Load tasks assigned to this user
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'tasks'), where('assignedTo', 'array-contains', user?.uid), orderBy('createdAt', 'desc'))
        );
        setAssignedTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('Could not load tasks:', e.message);
      }
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('fullName')));
        setAllUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      } catch (e) {
        console.warn('Could not load users:', e.message);
      }
    })();
  }, []);

  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch.trim()) return false;
    const q = userSearch.toLowerCase();
    return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const openPicker = (target, mode, currentValue) => {
    setPickerTarget(target); setPickerMode(mode);
    setPickerValue(currentValue); setPickerVisible(true);
  };

  const onPickerConfirm = (date) => {
    setPickerVisible(false);
    if (pickerTarget === 'arrived-date')      setArrivedDate(date);
    if (pickerTarget === 'arrived-time')      setArrivedTime(date);
    if (pickerTarget === 'next-action-date')  setNextActionDate(date);
    if (pickerTarget === 'time-completed')    setTimeCompleted(date);
  };

  const toggleTask = (taskId) =>
    setTasksFromPrevSelected((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );

  const toggleUser = (user) => {
    setTeamOnSite((prev) =>
      prev.find((u) => u.uid === user.uid)
        ? prev.filter((u) => u.uid !== user.uid)
        : [...prev, user]
    );
    setUserSearch(''); setShowDropdown(false);
  };

  const removeTeamMember = (uid) =>
    setTeamOnSite((prev) => prev.filter((u) => u.uid !== uid));

  const showSuccessAlert = (wasQueued) => {
    Alert.alert(
      wasQueued ? '📋 Saved Offline' : '✅ Job Report Submitted',
      wasQueued
        ? 'No internet — your report has been saved locally and will sync automatically when reconnected.\n\n📸 Don\'t forget to send screenshots via WhatsApp!'
        : 'Your job report has been submitted successfully.\n\n📸 Don\'t forget to send screenshots via WhatsApp!',
      [
        {
          text: 'Take me there',
          onPress: () => {
            navigation?.goBack();
            Linking.openURL('whatsapp://').catch(() =>
              Linking.openURL('https://wa.me').catch(() =>
                Alert.alert('WhatsApp not found', 'Please make sure WhatsApp is installed.')
              )
            );
          },
        },
        { text: 'OK', style: 'cancel', onPress: () => navigation?.goBack() },
      ]
    );
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      Alert.alert('Missing fields', 'Please enter a Project Name.'); return;
    }
    if (!scope.trim()) {
      Alert.alert('Missing fields', 'Please enter the Scope of work.'); return;
    }
    try {
      setSaving(true);
      const user = auth.currentUser;

      const arrivedDT = new Date(arrivedDate);
      arrivedDT.setHours(arrivedTime.getHours(), arrivedTime.getMinutes(), 0, 0);
      const timeCompletedDT = new Date(timeCompleted);

      const selectedPrevTasks = assignedTasks
        .filter((t) => tasksFromPrevSelected.includes(t.id))
        .map((t) => ({ id: t.id, title: t.title, project: t.projectName }));

      const payload = {
        projectName:        projectName.trim(),
        scope:              scope.trim(),
        tasksFromPrevious:  selectedPrevTasks,
        teamOnSite:         teamOnSite.map((u) => ({ uid: u.uid, fullName: u.fullName, email: u.email })),
        arrivedAt:          arrivedDT.toISOString(),
        completedTasks:     completedTasks.trim(),
        commentsCompleted:  commentsCompleted.trim(),
        outstandingTasks:   outstandingTasks.trim(),
        commentsOutstanding:commentsOutstanding.trim(),
        requiredNextAction: requiredNextAction.trim(),
        nextActionDate:     nextActionDate.toISOString(),
        timeCompleted:      timeCompletedDT.toISOString(),
        handoverContact:    handoverContact.trim(),
        submittedBy:        user?.uid || null,
        submittedByName:    user?.displayName || '',
        odooSynced:         false,
      };

      if (online) {
        await addDoc(collection(db, 'jobReports'), { ...payload, createdAt: serverTimestamp() });
        showSuccessAlert(false);
      } else {
        await enqueueOperation('addDoc', 'jobReports', { ...payload, createdAt: new Date().toISOString() });
        showSuccessAlert(true);
      }
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to save job report.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[C.bg, '#0A1220', C.bg]} style={s.flex}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="chevron-back" size={20} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Job Report</Text>
            <Text style={s.headerSub}>Timesheet Entry</Text>
          </View>
          <View style={s.headerBadge}>
            <Ionicons name="document-text-outline" size={12} color={C.primary} />
            <Text style={s.headerBadgeText}>TIMESHEET</Text>
          </View>
        </View>

        {!online && (
          <View style={s.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={15} color={C.offline} />
            <Text style={s.offlineBannerText}>
              Offline — your report will sync automatically when reconnected
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* PROJECT */}
          <SectionLabel iconName="briefcase-outline" label="Project" />
          <InputField label="Project Name" value={projectName} onChangeText={setProjectName}
            placeholder="Enter project name" iconName="briefcase-outline" />

          {/* SCOPE */}
          <SectionLabel iconName="list-outline" label="Scope of Work" />
          <InputField label="Scope" value={scope} onChangeText={setScope}
            placeholder={"1. Task one\n2. Task two\n3. Task three"}
            iconName="list-outline" multiline />

          {/* TASKS FROM PREVIOUS */}
          <SectionLabel iconName="refresh-circle-outline" label="Tasks from Previous" />
          {assignedTasks.length === 0 ? (
            <View style={s.emptyTasks}>
              <Ionicons name="checkmark-circle-outline" size={22} color={C.textMuted} />
              <Text style={s.emptyTasksText}>
                {online ? 'No outstanding tasks assigned to you' : 'Connect to load assigned tasks'}
              </Text>
            </View>
          ) : (
            <View style={s.taskList}>
              {assignedTasks.map((task) => {
                const selected = tasksFromPrevSelected.includes(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[s.taskCard, selected && s.taskCardSelected]}
                    onPress={() => toggleTask(task.id)}
                    activeOpacity={0.8}
                  >
                    {selected && <LinearGradient colors={[`${C.warn}15`, `${C.warn}05`]} style={StyleSheet.absoluteFill} />}
                    <View style={[s.taskCheckbox, selected && s.taskCheckboxSelected]}>
                      {selected && <Ionicons name="checkmark" size={12} color="#FFF" />}
                    </View>
                    <View style={s.taskInfo}>
                      <Text style={[s.taskTitle, selected && s.taskTitleSelected]}>{task.title}</Text>
                      {task.projectName ? <Text style={s.taskProject}>{task.projectName}</Text> : null}
                    </View>
                    <View style={[s.taskBadge, selected && s.taskBadgeSelected]}>
                      <Text style={[s.taskBadgeText, selected && s.taskBadgeTextSelected]}>
                        {selected ? 'INCLUDED' : 'INCLUDE'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* TEAM ON SITE */}
          <SectionLabel iconName="people-outline" label="Team Onsite" />
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

          {/* ARRIVED */}
          <SectionLabel iconName="enter-outline" label="Time & Date Arrived" />
          <View style={s.row}>
            <DateField label="Date Arrived" value={fmtDate(arrivedDate)} iconName="calendar-outline"
              onPress={() => openPicker('arrived-date', 'date', arrivedDate)} flex={1} />
            <View style={s.rowGap} />
            <DateField label="Time Arrived" value={fmtTime(arrivedTime)} iconName="time-outline"
              onPress={() => openPicker('arrived-time', 'time', arrivedTime)} flex={1} />
          </View>

          {/* COMPLETED TASKS */}
          <SectionLabel iconName="checkmark-done-outline" label="Completed Tasks" />
          <InputField label="Completed Tasks" value={completedTasks} onChangeText={setCompletedTasks}
            placeholder={"List tasks completed on this visit…"} iconName="checkmark-circle-outline" multiline />
          <InputField label="Comments on Completed" value={commentsCompleted} onChangeText={setCommentsCompleted}
            placeholder="Any notes on completed tasks…" iconName="chatbubble-outline" multiline />

          {/* OUTSTANDING TASKS */}
          <SectionLabel iconName="alert-circle-outline" label="Outstanding Tasks" />
          <InputField label="Outstanding Tasks" value={outstandingTasks} onChangeText={setOutstandingTasks}
            placeholder={"List tasks not completed…"} iconName="time-outline" multiline />
          <InputField label="Comments on Outstanding" value={commentsOutstanding} onChangeText={setCommentsOutstanding}
            placeholder="Reason tasks were not completed…" iconName="chatbubble-ellipses-outline" multiline />

          {/* NEXT ACTION */}
          <SectionLabel iconName="arrow-forward-circle-outline" label="Next Action" />
          <InputField label="Required for Next Action" value={requiredNextAction} onChangeText={setRequiredNextAction}
            placeholder="Specialist, tools, parts needed…" iconName="construct-outline" multiline />
          <DateField label="Next Action Date" value={fmtDate(nextActionDate)} iconName="calendar-outline"
            onPress={() => openPicker('next-action-date', 'date', nextActionDate)} />

          {/* WRAP-UP */}
          <SectionLabel iconName="exit-outline" label="Wrap-up" />
          <DateField label="Time Completed (Left Site)" value={fmtTime(timeCompleted)} iconName="time-outline"
            onPress={() => openPicker('time-completed', 'time', timeCompleted)} />
          <InputField label="Handover Contact" value={handoverContact} onChangeText={setHandoverContact}
            placeholder="Name of person handed over to" iconName="person-outline" />

          {/* SUBMIT */}
          <TouchableOpacity
            style={[s.submitBtn, saving && s.submitBtnDisabled]}
            onPress={handleSave} disabled={saving}
          >
            <LinearGradient
              colors={online ? [C.primary, C.primaryDark] : [C.offline, '#b07818']}
              style={s.submitGradient}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : (
                <View style={s.submitInner}>
                  <Ionicons name={online ? 'cloud-upload-outline' : 'save-outline'} size={20} color="#FFF" />
                  <Text style={s.submitText}>{online ? 'Submit Job Report' : 'Save Offline'}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>

      <DateTimePickerModal
        visible={pickerVisible} mode={pickerMode}
        value={pickerValue} onConfirm={onPickerConfirm}
        onCancel={() => setPickerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center',
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
  headerBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 1 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.offlineDim, borderBottomWidth: 1, borderBottomColor: C.offlineBorder,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  offlineBannerText: { flex: 1, fontSize: 12, color: C.offline, lineHeight: 17 },

  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2 },
  sectionIconWrap: {
    width: 24, height: 24, borderRadius: 6, backgroundColor: `${C.primary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionText: { fontSize: 12, fontWeight: '700', color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  inputContainer: { marginBottom: 4 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: C.textSecondary, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  iconInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border, minHeight: 46,
  },
  iconInputMulti: { alignItems: 'flex-start', minHeight: 90 },
  iconInputIcon:    { marginLeft: 12, marginRight: 2 },
  iconInputIconTop: { marginLeft: 12, marginRight: 2, marginTop: 14 },
  iconInputText:    { flex: 1, color: C.textPrimary, fontSize: 15, paddingHorizontal: 8, paddingVertical: 12 },
  iconInputTextMulti: { paddingVertical: 12, lineHeight: 22 },

  row:     { flexDirection: 'row', alignItems: 'flex-start' },
  rowGap:  { width: 10 },

  // Tasks from previous
  emptyTasks: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  emptyTasksText: { fontSize: 13, color: C.textMuted },
  taskList: { gap: 8 },
  taskCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.border, padding: 12, overflow: 'hidden',
  },
  taskCardSelected:   { borderColor: C.warnBorder },
  taskCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  taskCheckboxSelected: { backgroundColor: C.warn, borderColor: C.warn },
  taskInfo:           { flex: 1 },
  taskTitle:          { fontSize: 14, fontWeight: '600', color: C.textSecondary },
  taskTitleSelected:  { color: C.textPrimary },
  taskProject:        { fontSize: 11, color: C.textMuted, marginTop: 2 },
  taskBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
  },
  taskBadgeSelected:     { backgroundColor: C.warnDim, borderColor: C.warnBorder },
  taskBadgeText:         { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
  taskBadgeTextSelected: { color: C.warn },

  // Team search
  searchWrap: { position: 'relative', zIndex: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: `${C.primary}18`,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    gap: 5, borderWidth: 1, borderColor: C.primaryBorder,
  },
  chipText: { fontSize: 13, color: C.primaryLight, fontWeight: '600' },
  dropdown: {
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.borderLight, overflow: 'hidden', marginTop: 2,
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
    width: 34, height: 34, borderRadius: 17, backgroundColor: `${C.primary}20`,
    justifyContent: 'center', alignItems: 'center',
  },
  dropdownAvatarText: { fontSize: 14, fontWeight: '700', color: C.primary },
  dropdownInfo:  { flex: 1 },
  dropdownName:  { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  dropdownEmail: { fontSize: 12, color: C.textSecondary, marginTop: 1 },

  // Submit
  submitBtn:         { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.6 },
  submitGradient:    { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitInner:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText:        { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
});

export default JobReportScreen;