import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SteadyLinkProvider,
  SteadyHomeScreen,
  PairScreen,
  SafetyScreen,
  SessionScreen,
  SummaryScreen,
  SteadyStackParamList,
} from '../steadyup';

const Stack = createNativeStackNavigator<SteadyStackParamList>();

export default function RootNavigator() {
  return (
    <SteadyLinkProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SteadyHome" component={SteadyHomeScreen} />
        <Stack.Screen name="Pair" component={PairScreen} />
        <Stack.Screen name="Safety" component={SafetyScreen} />
        <Stack.Screen name="Session" component={SessionScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
      </Stack.Navigator>
    </SteadyLinkProvider>
  );
}
