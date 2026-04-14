import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mappingsStr = formData.get("mappings") as string;

    if (!file || !mappingsStr) {
      return NextResponse.json(
        { error: "Missing file or mappings" },
        { status: 400 }
      );
    }

    const mappings: Record<string, string> = JSON.parse(mappingsStr);
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(parseCSVLine);

    const parsed: Record<string, string>[] = [];
    for (const row of rows) {
      const data: Record<string, string> = {};
      headers.forEach((header, idx) => {
        const field = mappings[header];
        if (field && field !== "skip" && row[idx]) {
          data[field] = row[idx].trim();
        }
      });
      if (data.email) {
        parsed.push(data);
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json({ imported: 0, skipped: rows.length });
    }

    const allEmails = parsed.map((d) => d.email);
    const existingContacts = await prisma.contact.findMany({
      where: { email: { in: allEmails } },
      select: { email: true },
    });
    const existingSet = new Set(existingContacts.map((c) => c.email));

    const newRows = parsed.filter((d) => !existingSet.has(d.email));
    const skipped = rows.length - newRows.length;

    const companyNames = [
      ...new Set(newRows.map((d) => d.companyName).filter(Boolean)),
    ];

    const companyMap = new Map<string, string>();

    if (companyNames.length > 0) {
      const companyIds = companyNames.map((name) => `company-${slugify(name)}`);

      const existingCompanies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      });

      for (const c of existingCompanies) {
        companyMap.set(c.name.toLowerCase(), c.id);
      }

      const newCompanyNames = companyNames.filter(
        (name) => !companyMap.has(name.toLowerCase())
      );

      if (newCompanyNames.length > 0) {
        const companyData = newCompanyNames.map((name) => {
          const row = newRows.find(
            (d) => d.companyName?.toLowerCase() === name.toLowerCase()
          );
          return {
            id: `company-${slugify(name)}`,
            name,
            website: row?.companyWebsite || null,
            linkedinUrl: row?.companyLinkedin || null,
            industry: row?.companyIndustry || null,
            description: row?.companyDescription || null,
            employeeCount: row?.companySize ? parseInt(row.companySize) : null,
            country: row?.companyCountry || null,
            state: row?.companyState || null,
          };
        });

        await prisma.company.createMany({
          data: companyData,
          skipDuplicates: true,
        });

        for (const c of companyData) {
          companyMap.set(c.name.toLowerCase(), c.id);
        }
      }
    }

    const contactData = newRows.map((data) => {
      let firstName = data.firstName || "";
      let lastName = data.lastName || "";

      if (firstName && !lastName && firstName.includes(" ")) {
        const parts = firstName.split(" ");
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }

      if (!firstName) {
        firstName = data.email.split("@")[0];
      }

      return {
        firstName,
        lastName,
        email: data.email,
        position: data.position || null,
        seniority: data.seniority || null,
        linkedinUrl: data.linkedinUrl || null,
        country: data.country || null,
        state: data.state || null,
        companyId: data.companyName
          ? companyMap.get(data.companyName.toLowerCase()) || null
          : null,
        source: "csv-import",
      };
    });

    if (contactData.length > 0) {
      await prisma.contact.createMany({
        data: contactData,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      imported: contactData.length,
      skipped,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
