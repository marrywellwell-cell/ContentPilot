import { KeywordInput } from "../KeywordInput";

export default function KeywordInputExample() {
  const handleGenerate = (keyword: string, platforms: string[]) => {
    console.log("Generate triggered:", { keyword, platforms });
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <KeywordInput onGenerate={handleGenerate} />
    </div>
  );
}
