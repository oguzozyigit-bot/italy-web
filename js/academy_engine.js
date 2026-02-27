/* italky Academy - Universal STEM Solver Engine 
   Path: /js/academy_engine.js
*/

import { mountShell } from "/js/ui_shell.js";

// Sayfa yüklendiğinde shell'i giydir
document.addEventListener('DOMContentLoaded', () => {
    mountShell({ scroll: "auto" });
    initAcademy();
});

function initAcademy() {
    const solveBtn = document.getElementById('solveTrigger');
    const cameraIn = document.getElementById('cameraIn');
    const loadingState = document.getElementById('loadingState');
    const resultBox = document.getElementById('resultBox');

    if (!solveBtn || !cameraIn) return;

    solveBtn.onclick = () => cameraIn.click();

    cameraIn.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // UI Hazırlığı
        loadingState.style.display = 'block';
        solveBtn.style.display = 'none';
        resultBox.style.display = 'none';
        resultBox.innerHTML = '';

        try {
            // Görseli Base64'e çevir
            const base64Data = await fileToBase64(file);

            // RENDER BACKEND ÇAĞRISI (main.py'ye gider)
            const response = await fetch('https://italky-academy-api.onrender.com/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Data })
            });

            const result = await response.json();

            if (response.ok && result.solution) {
                // STEM Kontrolü (Backend'den NOT_STEM dönerse)
                if (result.solution.includes("NOT_STEM")) {
                    alert("Bu bir STEM sorusu değil Başkanım. Lütfen Matematik, Fizik, Kimya veya Biyoloji sorusu sor.");
                } else {
                    // Çözümü Ekrana Bas
                    resultBox.innerHTML = formatAIResponse(result.solution);
                    resultBox.style.display = 'block';
                }
            } else {
                throw new Error("API Hatası");
            }

        } catch (err) {
            console.error("Motor Hatası:", err);
            alert("Motor arızası! Lütfen internetini kontrol et veya tekrar dene Başkanım.");
        } finally {
            loadingState.style.display = 'none';
            solveBtn.style.display = 'flex';
        }
    };
}

// YARDIMCI: Dosyayı metne çevirir
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// YARDIMCI: AI yanıtını şıklaştırır (Kalın yazılar ve Satırlar)
function formatAIResponse(text) {
    // Markdown kalınlıklarını (**) <strong> yapar, satırları <br> yapar
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}
