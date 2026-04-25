import zlib from 'node:zlib';

function shannonEntropy(buffer) {
  if (!buffer.length) {
    return 0;
  }

  const counts = new Map();
  for (const byte of buffer) {
    counts.set(byte, (counts.get(byte) || 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function lsbBalanceScore(buffer) {
  if (!buffer.length) {
    return 0;
  }

  let ones = 0;
  for (const byte of buffer) {
    ones += byte & 1;
  }

  const ratio = ones / buffer.length;
  return Math.abs(0.5 - ratio) * 100;
}

function analyzePng(buffer) {
  const reasons = [];
  let score = 0;

  let offset = 8;
  let idatBuffers = [];
  let foundIend = false;
  let textChunkCount = 0;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextChunk = dataEnd + 4;

    if (dataEnd > buffer.length) {
      break;
    }

    if (type === 'IDAT') {
      idatBuffers.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      foundIend = true;
      if (nextChunk < buffer.length) {
        score += 35;
        reasons.push('PNG contains trailing bytes after IEND');
      }
      break;
    } else if (['tEXt', 'zTXt', 'iTXt'].includes(type)) {
      textChunkCount += 1;
    }

    offset = nextChunk;
  }

  if (textChunkCount > 0) {
    score += Math.min(20, textChunkCount * 5);
    reasons.push(`PNG contains ${textChunkCount} metadata text chunk(s)`);
  }

  if (foundIend && idatBuffers.length > 0) {
    try {
      const inflated = zlib.inflateSync(Buffer.concat(idatBuffers));
      const entropy = shannonEntropy(inflated);
      const balance = lsbBalanceScore(inflated);

      if (entropy > 7.2) {
        score += 15;
        reasons.push(`High inflated payload entropy (${entropy.toFixed(2)})`);
      }

      if (balance < 2.5) {
        score += 15;
        reasons.push(`Suspiciously balanced least-significant bits (${balance.toFixed(2)})`);
      }
    } catch {
      score += 10;
      reasons.push('PNG payload could not be inspected cleanly');
    }
  }

  return { score, suspicious: score >= 40, reasons };
}

function analyzeJpeg(buffer) {
  const reasons = [];
  let score = 0;

  const eoiIndex = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (eoiIndex !== -1 && eoiIndex + 2 < buffer.length) {
    score += 40;
    reasons.push('JPEG contains trailing bytes after EOI marker');
  }

  let offset = 2;
  let segmentCount = 0;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd9) {
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      break;
    }

    segmentCount += 1;
    if (marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)) {
      score += 2;
    }

    offset += 2 + length;
  }

  if (segmentCount > 20) {
    score += 10;
    reasons.push('JPEG has an unusually high number of segments');
  }

  return { score, suspicious: score >= 40, reasons };
}

function analyzeGeneric(buffer) {
  const entropy = shannonEntropy(buffer.subarray(Math.max(0, buffer.length - 2048)));
  const score = entropy > 7.6 ? 20 : 0;
  const reasons = entropy > 7.6 ? ['High tail entropy in image payload'] : [];
  return { score, suspicious: score >= 40, reasons };
}

export function analyzeSteganography(buffer, mimeType) {
  switch (mimeType) {
    case 'image/png':
      return analyzePng(buffer);
    case 'image/jpeg':
      return analyzeJpeg(buffer);
    default:
      return analyzeGeneric(buffer);
  }
}
