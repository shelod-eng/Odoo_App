// src/navigation/AppNavigator.js

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RegisterScreen      from '../screens/RegisterScreen';
import LoginScreen         from '../screens/LoginScreen';
import DashboardScreen     from '../screens/DashboardScreen';
import TravelLogScreen     from '../screens/TravelLogScreen';
import SubmittedLogsScreen from '../screens/SubmittedLogsScreen';
import JobReportScreen     from '../screens/JobReportScreen';
import DevTaskManagerScreen from '../screens/DevTaskManagerScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator
      screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#080C12' } }}
      initialRouteName="Login"
    >
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="Dashboard"      component={DashboardScreen} />
      <Stack.Screen name="TravelLog"      component={TravelLogScreen} />
      <Stack.Screen name="SubmittedLogs"  component={SubmittedLogsScreen} />
      <Stack.Screen name="JobReport"      component={JobReportScreen} />
      <Stack.Screen name="DevTaskManager" component={DevTaskManagerScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;