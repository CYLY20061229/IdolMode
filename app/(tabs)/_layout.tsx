import { Tabs } from "expo-router";
import TabIcon from "../../components/TabIcon";
import { useAppTheme } from "@/context/AppThemeContext";

export default function TabsLayout() {
  const theme = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 82,
          paddingTop: 10,
          paddingBottom: 18,
          borderTopWidth: 0,
          backgroundColor: theme.colors.card
        }
      }}
    >
      <Tabs.Screen
        name="friends"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "people" : "people-outline"} label="好友" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "chatbubbles" : "chatbubbles-outline"} label="聊天" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "star" : "star-outline"} label="更多" focused={focused} />
        }}
      />
    </Tabs>
  );
}
