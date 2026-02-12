// FILE: /js/boot.js
// ✅ First paint anti-flash (runs before other modules via <script defer>)

(() => {
  try {
    // hard set background for first paint
    const bg = "#02000f";

    // html/body background
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = "dark";

    // style tag
    if (!document.getElementById("italkyBootStyle")) {
      const st = document.createElement("style");
      st.id = "italkyBootStyle";
      st.textContent = `html,body{background:${bg} !important;}`;
      document.head.appendChild(st);
    }

    // theme-color
    const existing = document.querySelector('meta[name="theme-color"]');
    if (existing) existing.setAttribute("content", bg);
    else {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", bg);
      document.head.appendChild(meta);
    }
  } catch {}
})();
