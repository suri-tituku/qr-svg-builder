export function downloadSvg(svg: string, filename = "qr-code.svg") {
  const blob = new Blob([svg], {
    type: "image/svg+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
