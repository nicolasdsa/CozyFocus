const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const applyInline = (value: string): string => {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  output = output.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>'
  );
  return output;
};

const markdownToHtml = (md: string): string => {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const chunks: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inList = false;
  let listIsTask = false;

  const closeList = () => {
    if (!inList) {
      return;
    }
    chunks.push(listIsTask ? "</ul>" : "</ul>");
    inList = false;
    listIsTask = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        const code = escapeHtml(codeBuffer.join("\n"));
        chunks.push(`<pre><code>${code}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (line.trim() === "") {
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,2})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1]?.length ?? 1;
      const content = applyInline(headingMatch[2] ?? "");
      chunks.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeList();
      const content = applyInline(quoteMatch[1] ?? "");
      chunks.push(`<blockquote><p>${content}</p></blockquote>`);
      continue;
    }

    const taskMatch = line.match(/^\s*[-*+]\s*\[( |x|X)\]\s+(.*)$/);
    if (taskMatch) {
      if (!inList || !listIsTask) {
        closeList();
        chunks.push('<ul class="task-list">');
        inList = true;
        listIsTask = true;
      }
      const checked = (taskMatch[1] ?? "") !== " ";
      const content = applyInline(taskMatch[2] ?? "");
      const checkedAttr = checked ? " checked" : "";
      chunks.push(
        `<li class="task-list-item"><input type="checkbox" disabled${checkedAttr}> ${content}</li>`
      );
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bulletMatch) {
      if (!inList || listIsTask) {
        closeList();
        chunks.push("<ul>");
        inList = true;
        listIsTask = false;
      }
      const content = applyInline(bulletMatch[1] ?? "");
      chunks.push(`<li>${content}</li>`);
      continue;
    }

    closeList();
    chunks.push(`<p>${applyInline(line)}</p>`);
  }

  if (inCodeBlock) {
    const code = escapeHtml(codeBuffer.join("\n"));
    chunks.push(`<pre><code>${code}</code></pre>`);
  }

  closeList();

  return chunks.join("");
};

const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blockedTags = ["script", "style", "iframe", "object", "embed", "link", "meta"];
  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
};

export const renderMarkdown = (md: string): string => {
  const html = markdownToHtml(md ?? "");
  return sanitizeHtml(html);
};
