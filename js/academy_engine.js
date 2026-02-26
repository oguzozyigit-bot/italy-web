/* italky Academy - Universal STEM Solver Engine 
   Logic: Gemini (Primary) -> OpenAI (Secondary/Failover)
*/

export async function italkySolver(imageBlob) {
    try {
        // 1. GÖRSEL ANALİZİ BAŞLAT
        console.log("italkyAI: Görsel işleniyor...");
        
        // ÖNCE GEMINI'YI DENE (V12 Silindir 1)
        let result = await callGemini(imageBlob);

        // 2. FAILOVER MEKANİZMASI (Gemini hata verirse veya boş dönerse)
        if (!result || result.error) {
            console.warn("italkyAI: Gemini hata verdi, OpenAI yedek motor ateşleniyor...");
            result = await callOpenAI(imageBlob);
        }

        // 3. STEM DİSİPLİN KONTROLÜ
        if (result.type === "NOT_STEM") {
            return {
                success: false,
                message: "Ben bir STEM asistanıyım. Lütfen sadece Matematik, Fizik, Kimya veya Biyoloji sorusu gönder Başkanım."
            };
        }

        // 4. BAŞARILI SONUÇ
        return {
            success: true,
            data: result
        };

    } catch (err) {
        return { success: false, message: "Motor arızası! Lütfen tekrar dene." };
    }
}

// GEMINI API ÇAĞRISI
async function callGemini(blob) {
    // Burada Env'deki GEMINI_API_KEY kullanılarak fetch yapılacak
    // Prompt: "Bu bir STEM sorusu mu? Evet ise adım adım çöz ve şekil/grafik gerekiyorsa tarif et."
}

// OPENAI API ÇAĞRISI (Failover)
async function callOpenAI(blob) {
    // Burada Env'deki OPENAI_API_KEY kullanılarak fetch yapılacak
}
