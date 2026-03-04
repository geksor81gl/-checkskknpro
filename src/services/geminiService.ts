import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  // Priority: process.env.API_KEY (from dialog) > process.env.GEMINI_API_KEY (default)
  const key = typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : undefined;
  
  if (!key) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: key });
};

export interface SKKNAnalysis {
  titleScore: number;
  titleFeedback: string;
  titleSuggestions: string[];
  noveltyScore: number;
  feasibilityScore: number;
  scientificScore: number;
  formScore: number;
  plagiarismPercent: number;
  aiPercent: number;
  summary: string;
  deepReview: {
    structure: string;
    pedagogy: string;
    data: string;
  };
  references: { title: string; reason: string }[];
}

export const analyzeTitle = async (title: string): Promise<Partial<SKKNAnalysis>> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Phân tích tên đề tài Sáng kiến kinh nghiệm (SKKN) sau đây theo Thông tư 27/2020/TT-BGDĐT: "${title}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titleScore: { type: Type.NUMBER, description: "Điểm tên đề tài trên thang 10" },
          titleFeedback: { type: Type.STRING, description: "Nhận xét về tên đề tài" },
          titleSuggestions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "3-5 gợi ý tên đề tài mới chuyên nghiệp hơn" 
          }
        },
        required: ["titleScore", "titleFeedback", "titleSuggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeFullDocument = async (content: string): Promise<SKKNAnalysis> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Bạn là chuyên gia thẩm định SKKN. Hãy phân tích nội dung sau đây theo Thông tư 27/2020/TT-BGDĐT:
    
    NỘI DUNG:
    ${content.substring(0, 30000)} // Truncate if too long
    
    YÊU CẦU:
    1. Chấm điểm chi tiết các tiêu chí.
    2. Đánh giá tính mới, khả thi, khoa học và hình thức.
    3. Giả lập chỉ số đạo văn và nguy cơ AI.
    4. Đưa ra nhận xét chuyên sâu về cấu trúc, lý luận sư phạm và số liệu.
    5. Đề xuất 6-8 tài liệu tham khảo.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titleScore: { type: Type.NUMBER },
          titleFeedback: { type: Type.STRING },
          titleSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          noveltyScore: { type: Type.NUMBER, description: "Điểm tính mới (tối đa 30)" },
          feasibilityScore: { type: Type.NUMBER, description: "Điểm tính khả thi (tối đa 40)" },
          scientificScore: { type: Type.NUMBER, description: "Điểm tính khoa học (tối đa 20)" },
          formScore: { type: Type.NUMBER, description: "Điểm hình thức (tối đa 10)" },
          plagiarismPercent: { type: Type.NUMBER },
          aiPercent: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          deepReview: {
            type: Type.OBJECT,
            properties: {
              structure: { type: Type.STRING },
              pedagogy: { type: Type.STRING },
              data: { type: Type.STRING }
            }
          },
          references: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reason: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const autoFixContent = async (content: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Hãy thực hiện chế độ AUTO FIX cho nội dung SKKN sau:
    - Giảm tỷ lệ AI: Chỉnh sửa văn phong cá nhân hóa, thêm cảm xúc sư phạm.
    - Nâng cấp từ vựng: Sử dụng thuật ngữ giáo dục chuyên ngành theo Thông tư 27.
    - Paraphrasing: Viết lại các đoạn có nguy cơ trùng lặp.
    
    NỘI DUNG:
    ${content.substring(0, 20000)}`,
    config: {
      systemInstruction: "Bạn là biên tập viên cao cấp chuyên về Sáng kiến kinh nghiệm giáo dục."
    }
  });

  return response.text || "";
};
