import { InstagramPreview } from "../InstagramPreview";

export default function InstagramPreviewExample() {
  const mockData = {
    slides: [
      "🥑 Start your day right with these 5 superfoods!",
      "1. Avocado - Packed with healthy fats and fiber",
      "2. Greek Yogurt - High in protein and probiotics",
      "3. Berries - Antioxidant powerhouses",
      "4. Oatmeal - Sustained energy all morning",
      "5. Eggs - Complete protein source",
    ],
    caption: `Ready to transform your mornings? 🌅

These 5 superfoods will boost your energy and keep you satisfied until lunch!

Swipe through to discover each superfood's unique benefits. Which one is your favorite?

Drop a ❤️ if you're ready to upgrade your breakfast game!`,
    hashtags: [
      "healthybreakfast",
      "superfoods",
      "nutrition",
      "wellness",
      "healthyeating",
      "breakfast",
      "foodie",
      "healthylifestyle",
      "cleaneating",
      "nutrition",
    ],
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <InstagramPreview
        {...mockData}
        onRegenerate={() => console.log("Regenerate Instagram content")}
        onEdit={() => console.log("Edit Instagram content")}
      />
    </div>
  );
}
