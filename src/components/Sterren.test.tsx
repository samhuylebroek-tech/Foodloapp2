// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sterren, SterrenKiezer, SterrenSnel } from "./Sterren";

afterEach(cleanup);

async function axeFouten(el: Element) {
  const r = await axe.run(el, { resultTypes: ["violations"] });
  return r.violations.map((v) => `${v.id}: ${v.help}`);
}

describe("Sterren (alleen tonen)", () => {
  it("vertelt de score aan schermlezers in gewone taal", () => {
    render(<Sterren waarde={3} />);
    expect(screen.getByLabelText("3 van 5 sterren")).toBeTruthy();
  });
});

describe("SterrenKiezer", () => {
  it("heeft een duidelijke naam per knop en geen axe-overtredingen", async () => {
    const { container } = render(<SterrenKiezer waarde={2} onKies={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "1 ster" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "5 sterren" })).toBeTruthy();
    expect(await axeFouten(container)).toEqual([]);
  });

  it("toont welke sterren gekozen zijn via aria-pressed", () => {
    render(<SterrenKiezer waarde={2} onKies={() => {}} />);
    const knoppen = screen.getAllByRole("button");
    expect(knoppen.map((k) => k.getAttribute("aria-pressed"))).toEqual([
      "true",
      "true",
      "false",
      "false",
      "false",
    ]);
  });

  it("nog eens op dezelfde ster tikken wist de score (vergevingsgezind)", async () => {
    const onKies = vi.fn();
    render(<SterrenKiezer waarde={3} onKies={onKies} />);
    await userEvent.click(screen.getByRole("button", { name: "3 sterren" }));
    expect(onKies).toHaveBeenCalledWith(0);
  });

  it("werkt volledig met het toetsenbord", async () => {
    const onKies = vi.fn();
    render(<SterrenKiezer waarde={0} onKies={onKies} />);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onKies).toHaveBeenCalledWith(2);
  });

  it("knoppen zijn groot genoeg om te raken (≥ 44px, ruim boven WCAG 2.5.8)", () => {
    render(<SterrenKiezer waarde={0} onKies={() => {}} />);
    for (const k of screen.getAllByRole("button")) {
      expect(k.className).toMatch(/\bh-14\b/);
      expect(k.className).toMatch(/min-w-\[44px\]/);
    }
  });

  it("houdt de vijf sterren op één rij (geen 4 + 1 bij smalle kaarten of grote tekst)", () => {
    render(<SterrenKiezer waarde={0} onKies={() => {}} />);
    const rij = screen.getAllByRole("button")[0]!.parentElement!;
    expect(rij.className).not.toMatch(/flex-wrap/);
  });
});

describe("SterrenSnel", () => {
  it("groepeert de knoppen met een begrijpelijk label en is axe-schoon", async () => {
    const { container } = render(<SterrenSnel waarde={4} onKies={() => {}} />);
    expect(screen.getByRole("group", { name: "Jouw score: 4 van 5" })).toBeTruthy();
    expect(await axeFouten(container)).toEqual([]);
  });

  it("gekozen sterren hebben een donkere rand voor voldoende contrast", () => {
    const { container } = render(<SterrenSnel waarde={2} onKies={() => {}} />);
    const iconen = container.querySelectorAll("svg");
    expect(iconen[0]?.getAttribute("class")).toContain("text-[var(--honing-foreground)]");
    expect(iconen[4]?.getAttribute("class")).not.toContain("honing");
  });

  it("knoppen zijn minstens 44px hoog", () => {
    render(<SterrenSnel waarde={0} onKies={() => {}} />);
    for (const k of screen.getAllByRole("button")) expect(k.className).toMatch(/\bh-11\b/);
  });
});
