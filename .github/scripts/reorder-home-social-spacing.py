from pathlib import Path


def require_once(text, needle, label):
    count = text.count(needle)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")


# Home: move Search + Filter + AI block above the hero banner.
home_path = Path("src/screens/HomeScreenV2.js")
home = home_path.read_text()
search_start = "        <View style={styles.searchBlock}>\n"
search_end = "\n        <PopularNowRow items={popularNow} onPress={(movie) => navigation.navigate(\"Detail\", { movie })} />"
require_once(home, search_start, "home search start")
require_once(home, search_end, "home search end")
start = home.index(search_start)
end = home.index(search_end, start)
block = home[start:end]
# It used to live inside heroArea (8-space indent); as a sibling above heroArea it needs 6.
block = "\n".join(line[2:] if line.startswith("  ") else line for line in block.splitlines())
home = home[:start] + home[end:]
header_marker = "  const forYouHeader = (\n    <View>\n      <View style={styles.heroArea}>"
require_once(home, header_marker, "home header marker")
home = home.replace(
    header_marker,
    "  const forYouHeader = (\n    <View>\n" + block + "\n\n      <View style={styles.heroArea}>",
    1,
)
require_once(home, "    searchBlock: { marginTop: 20 },", "home search style")
home = home.replace(
    "    searchBlock: { marginTop: 20 },",
    "    searchBlock: { marginTop: 14, marginBottom: 10 },",
    1,
)
home_path.write_text(home)


# Social: give StoryBar breathing room below the top bar without moving the whole feed.
activity_path = Path("src/screens/ActivityScreen.js")
activity = activity_path.read_text()
story = '''      <StoryBar
        myAvatar={myAvatar}
        myStories={stories.myStories}
        friends={stories.friends}
        navigation={navigation}
        onChanged={refreshStories}
      />'''
require_once(activity, story, "social StoryBar")
activity = activity.replace(
    story,
    '''      <View style={styles.storySection}>
        <StoryBar
          myAvatar={myAvatar}
          myStories={stories.myStories}
          friends={stories.friends}
          navigation={navigation}
          onChanged={refreshStories}
        />
      </View>''',
    1,
)
style_anchor = '    content: { paddingHorizontal: 14, paddingBottom: 28 },'
require_once(activity, style_anchor, "social content style")
activity = activity.replace(
    style_anchor,
    style_anchor + '\n    storySection: { marginTop: 12 },',
    1,
)
activity_path.write_text(activity)

print("home search/AI moved above hero; social stories spaced")
