"use client";

// Select-all / Clear controls for a checkbox-list filter. Operates on
// every checkbox named `group` inside the nearest enclosing <form>, so
// it stays in sync with the server-rendered checkboxes without lifting
// their state into React.

export function CheckboxGroupControls({ group }: { group: string }) {
  function setAll(checked: boolean) {
    return (e: React.MouseEvent<HTMLButtonElement>) => {
      const form = e.currentTarget.closest("form");
      if (!form) return;
      const boxes = form.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="${group}"]`,
      );
      boxes.forEach((b) => {
        b.checked = checked;
      });
    };
  }

  return (
    <span className="flex gap-2 text-[10px] font-sans font-medium uppercase tracking-label">
      <button
        type="button"
        onClick={setAll(true)}
        className="text-ink hover:text-accent"
      >
        Select all
      </button>
      <span className="text-rule">·</span>
      <button
        type="button"
        onClick={setAll(false)}
        className="text-ink hover:text-accent"
      >
        Clear
      </button>
    </span>
  );
}
