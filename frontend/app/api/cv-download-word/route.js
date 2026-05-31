import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TabStopPosition, TabStopType, BorderStyle,
} from 'docx'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

function createModernDoc(cv) {
  const children = []

  // Name & Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `${cv.prenom} ${cv.nom}`, bold: true, size: 36, font: 'Calibri' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: cv.titre || '', italics: true, size: 24, color: '1a3a6b', font: 'Calibri' })],
      spacing: { after: 200 },
    })
  )

  // Contact
  const contactParts = [cv.email, cv.telephone, cv.ville ? `${cv.ville}, ${cv.pays}` : cv.pays].filter(Boolean)
  if (contactParts.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactParts.join('  |  '), size: 18, color: '666666', font: 'Calibri' })],
        spacing: { after: 100 },
      })
    )
  }
  const links = [cv.linkedin, cv.github, cv.siteWeb].filter(Boolean)
  if (links.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: links.join('  |  '), size: 18, color: '1a3a6b', font: 'Calibri' })],
        spacing: { after: 200 },
      })
    )
  }

  // Phrase d'accroche
  if (cv.phrase_accroche) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: cv.phrase_accroche, italics: true, size: 20, font: 'Calibri' })],
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
      })
    )
  }

  // Résumé
  const resume = cv.resume_ameliore || cv.resume
  if (resume) {
    children.push(
      new Paragraph({
        text: 'PROFIL PROFESSIONNEL',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'PROFIL PROFESSIONNEL', bold: true, size: 24, color: '1a3a6b', font: 'Calibri' })],
      }),
      new Paragraph({
        children: [new TextRun({ text: resume, size: 20, font: 'Calibri' })],
        spacing: { after: 200 },
      })
    )
  }

  // Experiences
  if (cv.experiences?.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'EXPÉRIENCES PROFESSIONNELLES', bold: true, size: 24, color: '1a3a6b', font: 'Calibri' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
      })
    )
    for (const exp of cv.experiences) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: exp.poste || '', bold: true, size: 22, font: 'Calibri' })],
          spacing: { before: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `${exp.entreprise || ''}`, italics: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: `  |  ${exp.dateDebut || ''} — ${exp.posteActuel ? 'Présent' : exp.dateFin || ''}`, size: 18, color: '888888', font: 'Calibri' }),
          ],
          spacing: { after: 60 },
        })
      )
      const bullets = exp.description_amelioree?.length ? exp.description_amelioree : (exp.description ? [exp.description] : [])
      for (const b of bullets) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: b.replace(/^[•\-]\s*/, ''), size: 20, font: 'Calibri' })],
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        )
      }
    }
  }

  // Formations
  if (cv.formations?.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'FORMATION', bold: true, size: 24, color: '1a3a6b', font: 'Calibri' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
      })
    )
    for (const f of cv.formations) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: f.diplome || '', bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: f.mention ? ` — ${f.mention}` : '', italics: true, size: 20, font: 'Calibri' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `${f.etablissement || ''}`, size: 20, font: 'Calibri' }),
            new TextRun({ text: `  |  ${f.annee || ''}`, size: 18, color: '888888', font: 'Calibri' }),
          ],
          spacing: { after: 80 },
        })
      )
    }
  }

  // Compétences
  const allSkills = [...(cv.competencesTech || []), ...(cv.competencesSoft || []), ...(cv.competences_suggerees || [])]
  if (allSkills.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'COMPÉTENCES', bold: true, size: 24, color: '1a3a6b', font: 'Calibri' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
      }),
      new Paragraph({
        children: [new TextRun({ text: allSkills.join('  •  '), size: 20, font: 'Calibri' })],
        spacing: { after: 100 },
      })
    )
  }

  // Langues
  if (cv.langues?.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'LANGUES', bold: true, size: 24, color: '1a3a6b', font: 'Calibri' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
      })
    )
    for (const l of cv.langues) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${l.langue}`, bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: ` — ${l.niveau}`, size: 20, color: '666666', font: 'Calibri' }),
          ],
          spacing: { after: 40 },
        })
      )
    }
  }

  return new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
      },
      children,
    }],
  })
}

export async function POST(request) {
  try {
    const cv = await request.json()
    const doc = createModernDoc(cv)
    const buffer = await Packer.toBuffer(doc)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename=CV_${cv.prenom || 'Mon'}_${cv.nom || 'CV'}.docx`,
      },
    })
  } catch (err) {
    console.error('[CV Word] Error:', err)
    return NextResponse.json({ error: 'Erreur lors de la génération Word.' }, { status: 500 })
  }
}
