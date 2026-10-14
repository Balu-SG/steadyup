import { createNativeStackNavigator } from '@amazon-devices/react-navigation__native-stack';
import {
  SteadyLinkProvider,
  SteadyHomeScreen,
  PairScreen,
  SafetyScreen,
  SessionScreen,
  SummaryScreen,
  SteadyStackParamList,
} from '@multi-tv/shared-ui';

const Stack = createNativeStackNavigator<SteadyStackParamList>();

export default function VegaRootNavigator() {
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
