// src/screens/DevTaskManagerScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// DEV ONLY — Create and assign tasks to users
// Simulates what Odoo would push to the app in production
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth, collection, addDoc, serverTimestamp } from '../services/firebase';
import { getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

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
  dev:          '#A855F7',
  devDim:       '#A855F715',
  devBorder:    '#A855F740',
  danger:       '#E84545',
  dangerDim:    '#E8454515',
  dangerBorder: '#E8454540',
  success:      '#22C55E',
  successDim:   '#22C55E15',
  warn:         '#F59E0B',
};

const SectionLabel = ({ iconName, label, color }) => {
  const col = color || C.primary;
  return (
    <View style={s.sectionLabel}>
      <View style={[s.sectionIconWrap, { backgroundColor: col + '18' }]}>
        <Ionicons name={iconName} size={14} color={col} />
      </View>
      <Text style={[s.sectionText, { color: col }]}>{label}</Text>
      <View style={[s.sectionLine, { backgroundColor: col + '20' }]} />
    </View>
  );
};

const InputField = ({ label, flex, iconName, multiline, ...props }) => (
  <View style={[s.inputContainer, flex && { flex }]}>
    {label && <Text style={s.inputLabel}>{label}</Text>}
    <View style={[s.iconInput, multiline && s.iconInputMulti]}>
      {iconName && (
        <Ionicons name={iconName} size={16} color={C.textMuted}
          style={multiline ? s.iconInputIconTop : s.iconInputIcon} />
      )}
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

const DevTaskManagerScreen = ({ navigation }) => {
  const [tab,          setTab]          = useState('create');
  const [projectName,  setProjectName]  = useState('');
  const [taskTitle,    setTaskTitle]    = useState('');
  const [description,  setDescription]  = useState('');
  const [assignedTo,   setAssignedTo]   = useState([]);
  const [userSearch,   setUserSearch]   = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [allUsers,     setAllUsers]     = useState([]);
  const [allTasks,     setAllTasks]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('fullName')));
        setAllUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      } catch (e) { console.warn('users:', e.message); }
    })();
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      setAllTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.warn('tasks:', e.message); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadTasks().finally(() => setLoading(false));
  }, [loadTasks]));

  const onRefresh = async () => { setRefreshing(true); await loadTasks(); setRefreshing(false); };

  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch.trim()) return false;
    const q = userSearch.toLowerCase();
    return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const toggleUser = (user) => {
    setAssignedTo((prev) =>
      prev.find((u) => u.uid === user.uid)
        ? prev.filter((u) => u.uid !== user.uid)
        : [...prev, user]
    );
    setUserSearch(''); setShowDropdown(false);
  };

  const removeAssignee = (uid) => setAssignedTo((prev) => prev.filter((u) => u.uid !== uid));

  const handleCreate = async () => {
    if (!taskTitle.trim()) { Alert.alert('Missing fields', 'Please enter a Task Title.'); return; }
    if (assignedTo.length === 0) { Alert.alert('Missing fields', 'Please assign this task to at least one user.'); return; }
    try {
      setSaving(true);
      const user = auth.currentUser;
      await addDoc(collection(db, 'tasks'), {
        title:             taskTitle.trim(),
        projectName:       projectName.trim(),
        description:       description.trim(),
        assignedTo:        assignedTo.map((u) => u.uid),
        assignedToDetails: assignedTo.map((u) => ({ uid: u.uid, fullName: u.fullName, email: u.email })),
        createdBy:         user?.uid || null,
        createdByName:     user?.displayName || '',
        status:            'pending',
        source:            'dev',
        createdAt:         serverTimestamp(),
      });
      setProjectName(''); setTaskTitle(''); setDescription(''); setAssignedTo([]);
      Alert.alert('Task Created', 'Task has been assigned successfully.', [
        { text: 'OK', onPress: () => { setTab('tasks'); loadTasks(); } },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to create task.');
    } finally { setSaving(false); }
  };

  const handleDelete = (task) => {
    Alert.alert('Delete Task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setDeletingId(task.id);
          await deleteDoc(doc(db, 'tasks', task.id));
          setAllTasks((prev) => prev.filter((t) => t.id !== task.id));
        } catch (err) {
          Alert.alert('Error', err.message ?? 'Failed to delete.');
        } finally { setDeletingId(null); }
      }},
    ]);
  };

  return (
    <View style={s.flex}>
      <LinearGradient colors={[C.bg, '#0A1220', C.bg]} style={s.flex}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="chevron-back" size={20} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Task Manager</Text>
            <Text style={s.headerSub}>Development use only</Text>
          </View>
          <View style={s.devBadge}>
            <Ionicons name="code-slash-outline" size={12} color={C.dev} />
            <Text style={s.devBadgeText}>DEV</Text>
          </View>
        </View>

        <View style={s.devNotice}>
          <Ionicons name="information-circle-outline" size={15} color={C.dev} />
          <Text style={s.devNoticeText}>
            In production, tasks will be pushed automatically from Odoo. This screen is for development testing only.
          </Text>
        </View>

        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, tab === 'create' && s.tabActive]} onPress={() => setTab('create')}>
            {tab === 'create' && <LinearGradient colors={[C.primary + '25', C.primary + '10']} style={StyleSheet.absoluteFill} />}
            <Ionicons name="add-circle-outline" size={16} color={tab === 'create' ? C.primary : C.textMuted} />
            <Text style={[s.tabText, tab === 'create' && s.tabTextActive]}>Create Task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'tasks' && s.tabActive]} onPress={() => { setTab('tasks'); loadTasks(); }}>
            {tab === 'tasks' && <LinearGradient colors={[C.primary + '25', C.primary + '10']} style={StyleSheet.absoluteFill} />}
            <Ionicons name="list-outline" size={16} color={tab === 'tasks' ? C.primary : C.textMuted} />
            <Text style={[s.tabText, tab === 'tasks' && s.tabTextActive]}>All Tasks</Text>
            {allTasks.length > 0 && (
              <View style={s.tabCount}><Text style={s.tabCountText}>{allTasks.length}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        {tab === 'create' && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionLabel iconName="briefcase-outline" label="Project and Task" color={C.dev} />
            <InputField label="Project Name (optional)" value={projectName} onChangeText={setProjectName}
              placeholder="e.g. Office Refurbishment" iconName="briefcase-outline" />
            <InputField label="Task Title *" value={taskTitle} onChangeText={setTaskTitle}
              placeholder="e.g. Install CCTV cameras" iconName="checkmark-circle-outline" />
            <InputField label="Description" value={description} onChangeText={setDescription}
              placeholder="Describe what needs to be done..." iconName="document-text-outline" multiline />

            <SectionLabel iconName="people-outline" label="Assign To" color={C.dev} />
            {assignedTo.length > 0 && (
              <View style={s.chips}>
                {assignedTo.map((u) => (
                  <TouchableOpacity key={u.uid} style={s.chip} onPress={() => removeAssignee(u.uid)}>
                    <Ionicons name="person" size={11} color={C.primaryLight} />
                    <Text style={s.chipText}>{u.fullName}</Text>
                    <Ionicons name="close" size={12} color={C.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={s.searchWrap}>
              <View style={s.inputContainer}>
                <Text style={s.inputLabel}>Search user</Text>
                <View style={s.iconInput}>
                  <Ionicons name="search-outline" size={16} color={C.textMuted} style={s.iconInputIcon} />
                  <TextInput
                    style={s.iconInputText} value={userSearch}
                    onChangeText={(t) => { setUserSearch(t); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Type name or email..." placeholderTextColor={C.textMuted}
                  />
                </View>
              </View>
              {showDropdown && filteredUsers.length > 0 && (
                <View style={s.dropdown}>
                  {filteredUsers.slice(0, 6).map((u) => {
                    const selected = assignedTo.find((x) => x.uid === u.uid);
                    return (
                      <TouchableOpacity key={u.uid} style={[s.dropdownItem, selected && s.dropdownItemSelected]} onPress={() => toggleUser(u)}>
                        <View style={s.dropdownAvatar}><Text style={s.dropdownAvatarText}>{u.fullName?.[0]?.toUpperCase() ?? '?'}</Text></View>
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

            <TouchableOpacity style={[s.createBtn, saving && s.createBtnDisabled]} onPress={handleCreate} disabled={saving}>
              <LinearGradient colors={[C.dev, '#7E22CE']} style={s.createGrad}>
                {saving ? <ActivityIndicator color="#FFF" /> : (
                  <View style={s.submitInner}>
                    <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                    <Text style={s.submitText}>Create and Assign Task</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {tab === 'tasks' && (
          loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={s.loadingText}>Loading tasks...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}>
              {allTasks.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="clipboard-outline" size={40} color={C.textMuted} />
                  <Text style={s.emptyTitle}>No Tasks Yet</Text>
                  <Text style={s.emptyText}>Create a task in the Create tab to see it here.</Text>
                </View>
              ) : (
                allTasks.map((task) => (
                  <View key={task.id} style={s.taskCard}>
                    <View style={[s.taskStrip, task.status === 'completed' ? s.taskStripDone : s.taskStripPending]} />
                    <View style={s.taskInner}>
                      <View style={s.taskTopRow}>
                        <View style={s.taskMeta}>
                          {task.projectName ? (
                            <View style={s.projectTag}>
                              <Ionicons name="briefcase-outline" size={10} color={C.primary} />
                              <Text style={s.projectTagText}>{task.projectName}</Text>
                            </View>
                          ) : null}
                          <View style={[s.statusTag, task.status === 'completed' ? s.statusTagDone : s.statusTagPending]}>
                            <Text style={[s.statusTagText, task.status === 'completed' ? s.statusTagTextDone : s.statusTagTextPending]}>
                              {task.status === 'completed' ? 'COMPLETED' : 'PENDING'}
                            </Text>
                          </View>
                          <View style={s.sourceTag}>
                            <Ionicons name="code-slash-outline" size={10} color={C.dev} />
                            <Text style={s.sourceTagText}>DEV</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(task)} disabled={deletingId === task.id}>
                          {deletingId === task.id
                            ? <ActivityIndicator size="small" color={C.danger} />
                            : <Ionicons name="trash-outline" size={16} color={C.danger} />
                          }
                        </TouchableOpacity>
                      </View>
                      <Text style={s.taskTitle}>{task.title}</Text>
                      {task.description ? <Text style={s.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
                      {task.assignedToDetails?.length > 0 && (
                        <View style={s.assigneesRow}>
                          <Ionicons name="people-outline" size={13} color={C.textMuted} />
                          <View style={s.assigneeChips}>
                            {task.assignedToDetails.map((a) => (
                              <View key={a.uid} style={s.assigneeChip}>
                                <Text style={s.assigneeChipText}>{a.fullName}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )
        )}
      </LinearGradient>
    </View>
  );
};

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
  devBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.devDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.devBorder,
  },
  devBadgeText: { fontSize: 11, fontWeight: '700', color: C.dev, letterSpacing: 1 },
  devNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.devDim, borderBottomWidth: 1, borderBottomColor: C.devBorder,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  devNoticeText: { flex: 1, fontSize: 12, color: C.dev, lineHeight: 17 },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, gap: 4, paddingTop: 10,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10, overflow: 'hidden', marginBottom: 1,
  },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabText:       { fontSize: 14, fontWeight: '600', color: C.textMuted },
  tabTextActive: { color: C.primary },
  tabCount:      { backgroundColor: C.primary + '25', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tabCountText:  { fontSize: 11, fontWeight: '700', color: C.primary },
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2 },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  sectionText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: 1 },
  inputContainer: { marginBottom: 4 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: C.textSecondary, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  iconInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border, minHeight: 46,
  },
  iconInputMulti:     { alignItems: 'flex-start', minHeight: 90 },
  iconInputIcon:      { marginLeft: 12, marginRight: 2 },
  iconInputIconTop:   { marginLeft: 12, marginRight: 2, marginTop: 14 },
  iconInputText:      { flex: 1, color: C.textPrimary, fontSize: 15, paddingHorizontal: 8, paddingVertical: 12 },
  iconInputTextMulti: { paddingVertical: 12, lineHeight: 22 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary + '18',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    gap: 5, borderWidth: 1, borderColor: C.primaryBorder,
  },
  chipText: { fontSize: 13, color: C.primaryLight, fontWeight: '600' },
  searchWrap: { position: 'relative', zIndex: 10 },
  dropdown: {
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.borderLight, overflow: 'hidden', marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11,
    gap: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownItemSelected: { backgroundColor: C.primary + '10' },
  dropdownAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary + '20', justifyContent: 'center', alignItems: 'center' },
  dropdownAvatarText: { fontSize: 14, fontWeight: '700', color: C.primary },
  dropdownInfo:  { flex: 1 },
  dropdownName:  { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  dropdownEmail: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  createBtn:         { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  createBtnDisabled: { opacity: 0.6 },
  createGrad:        { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitInner:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText:        { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: C.textSecondary },
  emptyWrap:   { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: C.textSecondary },
  emptyText:   { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  taskCard: {
    flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border, overflow: 'hidden', marginBottom: 10,
  },
  taskStrip:        { width: 4 },
  taskStripPending: { backgroundColor: C.warn },
  taskStripDone:    { backgroundColor: C.success },
  taskInner: { flex: 1, padding: 14, gap: 8 },
  taskTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  taskMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  projectTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primary + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: C.primaryBorder,
  },
  projectTagText:       { fontSize: 10, fontWeight: '600', color: C.primary },
  statusTag:            { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  statusTagPending:     { backgroundColor: C.warn + '15', borderColor: C.warn + '40' },
  statusTagDone:        { backgroundColor: C.successDim, borderColor: C.success + '40' },
  statusTagText:        { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  statusTagTextPending: { color: C.warn },
  statusTagTextDone:    { color: C.success },
  sourceTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.devDim, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: C.devBorder,
  },
  sourceTagText: { fontSize: 10, fontWeight: '600', color: C.dev },
  deleteBtn:     { padding: 4 },
  taskTitle:     { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  taskDesc:      { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  assigneesRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  assigneeChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assigneeChip:  {
    backgroundColor: C.primary + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.primaryBorder,
  },
  assigneeChipText: { fontSize: 11, color: C.primaryLight, fontWeight: '600' },
});

export default DevTaskManagerScreen;