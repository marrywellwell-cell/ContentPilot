import { BlogPreview } from "../BlogPreview";

export default function BlogPreviewExample() {
  const mockData = {
    title: "5 Superfoods to Transform Your Morning Routine",
    metaDescription:
      "Discover the top 5 superfoods that will boost your energy and improve your health. Learn how to incorporate these nutrient-dense foods into your breakfast routine.",
    content: `
      <h2>Why Breakfast Matters</h2>
      <p>Starting your day with the right nutrients can significantly impact your energy levels, focus, and overall well-being. The foods you choose for breakfast set the tone for the entire day.</p>
      
      <h2>The 5 Best Superfoods for Breakfast</h2>
      
      <h3>1. Avocado</h3>
      <p>Rich in healthy fats and fiber, avocados provide sustained energy and help keep you feeling full. They're also packed with potassium and vitamins.</p>
      
      <h3>2. Greek Yogurt</h3>
      <p>A protein powerhouse that supports muscle health and digestive wellness thanks to probiotics.</p>
      
      <h3>3. Berries</h3>
      <p>Loaded with antioxidants that fight inflammation and support brain health.</p>
      
      <h2>Frequently Asked Questions</h2>
      <p><strong>Q: How much should I eat for breakfast?</strong><br>
      A: Aim for a balanced meal with 300-400 calories including protein, healthy fats, and complex carbs.</p>
    `,
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <BlogPreview
        {...mockData}
        onRegenerate={() => console.log("Regenerate blog content")}
        onEdit={() => console.log("Edit blog content")}
      />
    </div>
  );
}
