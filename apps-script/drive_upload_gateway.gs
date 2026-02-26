/**
 * Todos a una - Google Apps Script gateway for document uploads.
 *
 * Supported actions:
 * - upload (multipart/form-data, supports binary file or base64 fields)
 * - delete (application/json)
 *
 * Required Script Properties:
 * - UPLOAD_TOKEN_SECRET
 * - APPS_SCRIPT_SHARED_SECRET
 *
 * Optional Script Properties:
 * - APPS_SCRIPT_UPLOAD_FOLDER_ID
 */

function doPost(e) {
  try {
    var request = parseIncomingRequest_(e);
    var action = String(request.fields.action || "").trim().toLowerCase();

    if (action === "upload") {
      return jsonResponse_(
        handleUploadAction_(request.fields, request.files),
      );
    }

    if (action === "delete") {
      return jsonResponse_(
        handleDeleteAction_(request.fields),
      );
    }

    return jsonResponse_(errorPayload_("invalid_action", "Unsupported action"));
  } catch (error) {
    return jsonResponse_(errorPayload_(
      "internal_error",
      error instanceof Error ? error.message : String(error),
    ));
  }
}

function handleUploadAction_(fields, files) {
  var uploadToken = stringOrEmpty_(fields.upload_token);
  var stagingId = stringOrEmpty_(fields.staging_id);
  if (!uploadToken) {
    return errorPayload_("missing_upload_token", "upload_token is required");
  }
  if (!stagingId) {
    return errorPayload_("missing_staging_id", "staging_id is required");
  }

  var file = files.file || firstFile_(files);
  if (!file) {
    var inlineFileResult = parseInlineFileFromFields_(fields);
    if (inlineFileResult.error) {
      return errorPayload_("invalid_file_base64", inlineFileResult.error);
    }
    file = inlineFileResult.file;
  }
  if (!file) {
    return errorPayload_(
      "missing_file",
      "multipart field 'file' is required (or provide multipart field 'file_base64')",
    );
  }

  var uploadTokenSecret = getRequiredScriptProperty_("UPLOAD_TOKEN_SECRET");
  var tokenCheck = verifySignedToken_(uploadToken, uploadTokenSecret);
  if (!tokenCheck.ok) {
    return errorPayload_("invalid_upload_token", tokenCheck.reason);
  }

  var tokenPayload = tokenCheck.payload;
  if (stringOrEmpty_(tokenPayload.type) !== "upload") {
    return errorPayload_("invalid_upload_token", "Token type must be 'upload'");
  }
  if (stringOrEmpty_(tokenPayload.staging_id) !== stagingId) {
    return errorPayload_("invalid_upload_token", "Token staging_id mismatch");
  }
  if (!stringOrEmpty_(tokenPayload.session_id)) {
    return errorPayload_("invalid_upload_token", "Token session_id missing");
  }

  var mime = String(file.mime || "").trim().toLowerCase();
  var sizeBytes = file.bytes.length;
  var allowedMime = normalizeStringArray_(tokenPayload.allowed_mime);
  if (allowedMime.length && allowedMime.indexOf(mime) === -1) {
    return errorPayload_("invalid_mime", "MIME not allowed: " + mime);
  }

  var maxSize = toInteger_(tokenPayload.max_size_bytes);
  if (maxSize > 0 && sizeBytes > maxSize) {
    return errorPayload_("file_too_large", "File exceeds max_size_bytes");
  }

  var fileName = sanitizeFileName_(file.name || "upload.bin");
  var blob = Utilities.newBlob(file.bytes, mime || "application/octet-stream", fileName);

  var folderId = getOptionalScriptProperty_("APPS_SCRIPT_UPLOAD_FOLDER_ID");
  var driveFile;
  if (folderId) {
    driveFile = DriveApp.getFolderById(folderId).createFile(blob);
  } else {
    driveFile = DriveApp.createFile(blob);
  }

  var now = currentUnixSeconds_();
  var receiptPayload = {
    iss: "todos-a-una-apps-script",
    type: "upload_receipt",
    session_id: stringOrEmpty_(tokenPayload.session_id),
    staging_id: stagingId,
    jti: stringOrEmpty_(tokenPayload.jti),
    drive_file_id: driveFile.getId(),
    name: driveFile.getName(),
    mime: mime,
    size: sizeBytes,
    iat: now,
    exp: now + 3600,
  };

  var sharedSecret = getRequiredScriptProperty_("APPS_SCRIPT_SHARED_SECRET");
  var receipt = createSignedToken_(receiptPayload, sharedSecret);

  return {
    ok: true,
    drive_file_id: driveFile.getId(),
    name: driveFile.getName(),
    mime: mime,
    size: sizeBytes,
    receipt: receipt,
  };
}

function handleDeleteAction_(fields) {
  var providedSecret = stringOrEmpty_(fields.shared_secret);
  var expectedSecret = getRequiredScriptProperty_("APPS_SCRIPT_SHARED_SECRET");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return errorPayload_("unauthorized", "shared_secret is invalid");
  }

  var fileIds = normalizeFileIds_(fields.file_ids);
  var deleted = [];
  var notFound = [];

  for (var i = 0; i < fileIds.length; i += 1) {
    var fileId = fileIds[i];
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
      deleted.push(fileId);
    } catch (_error) {
      notFound.push(fileId);
    }
  }

  return {
    ok: true,
    deleted: deleted,
    not_found: notFound,
  };
}

function parseIncomingRequest_(e) {
  var postData = e && e.postData ? e.postData : null;
  var contentType = String(postData && postData.type ? postData.type : "").toLowerCase();

  if (contentType.indexOf("multipart/form-data") === 0) {
    return parseMultipartRequest_(postData);
  }

  if (contentType.indexOf("application/json") === 0) {
    var jsonBody = {};
    try {
      jsonBody = JSON.parse(String(postData && postData.contents ? postData.contents : "{}"));
    } catch (_error) {
      jsonBody = {};
    }
    return {
      fields: (jsonBody && typeof jsonBody === "object" && !Array.isArray(jsonBody)) ? jsonBody : {},
      files: {},
    };
  }

  var fallbackFields = {};
  var params = (e && e.parameter) ? e.parameter : {};
  for (var key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      fallbackFields[key] = params[key];
    }
  }
  return { fields: fallbackFields, files: {} };
}

function parseMultipartRequest_(postData) {
  var boundary = extractBoundary_(String(postData && postData.type ? postData.type : ""));
  if (!boundary) {
    return { fields: {}, files: {} };
  }

  var rawIso = getPostDataIsoString_(postData);
  var delimiter = "--" + boundary;
  var parts = rawIso.split(delimiter);
  var fields = {};
  var files = {};

  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    if (!part) continue;
    if (part === "--" || part === "--\r\n") continue;

    if (part.indexOf("\r\n") === 0) {
      part = part.substring(2);
    }
    if (part.lastIndexOf("\r\n") === part.length - 2) {
      part = part.substring(0, part.length - 2);
    }
    if (part.lastIndexOf("--") === part.length - 2) {
      part = part.substring(0, part.length - 2);
    }

    var headerSplit = part.indexOf("\r\n\r\n");
    if (headerSplit < 0) continue;

    var rawHeaders = part.substring(0, headerSplit);
    var rawBody = part.substring(headerSplit + 4);
    if (rawBody.lastIndexOf("\r\n") === rawBody.length - 2) {
      rawBody = rawBody.substring(0, rawBody.length - 2);
    }

    var disposition = parseContentDisposition_(rawHeaders);
    if (!disposition || !disposition.name) continue;

    if (disposition.filename) {
      files[disposition.name] = {
        name: disposition.filename,
        mime: extractContentType_(rawHeaders) || "application/octet-stream",
        bytes: isoStringToBytes_(rawBody),
      };
    } else {
      fields[disposition.name] = rawBody;
    }
  }

  return { fields: fields, files: files };
}

function extractBoundary_(contentType) {
  var match = /boundary=([^;]+)/i.exec(String(contentType || ""));
  if (!match || !match[1]) return "";
  var boundary = String(match[1]).trim();
  if (boundary.charAt(0) === '"' && boundary.charAt(boundary.length - 1) === '"') {
    boundary = boundary.substring(1, boundary.length - 1);
  }
  return boundary;
}

function parseContentDisposition_(rawHeaders) {
  var lineMatch = /content-disposition:\s*([^\r\n]+)/i.exec(String(rawHeaders || ""));
  if (!lineMatch || !lineMatch[1]) return null;

  var value = lineMatch[1];
  var nameMatch = /name="([^"]+)"/i.exec(value);
  if (!nameMatch || !nameMatch[1]) return null;

  var filenameMatch = /filename="([^"]*)"/i.exec(value);
  var filename = filenameMatch && filenameMatch[1] ? filenameMatch[1] : "";
  return {
    name: nameMatch[1],
    filename: sanitizeFileName_(filename),
  };
}

function extractContentType_(rawHeaders) {
  var match = /content-type:\s*([^\r\n]+)/i.exec(String(rawHeaders || ""));
  return match && match[1] ? String(match[1]).trim().toLowerCase() : "";
}

function getPostDataIsoString_(postData) {
  if (!postData) return "";

  if (postData.bytes && postData.bytes.length) {
    return Utilities.newBlob(postData.bytes).getDataAsString("ISO-8859-1");
  }

  if (postData.contents) {
    return String(postData.contents);
  }

  return "";
}

function isoStringToBytes_(value) {
  var text = String(value || "");
  var bytes = [];
  for (var i = 0; i < text.length; i += 1) {
    bytes.push(text.charCodeAt(i) & 0xff);
  }
  return bytes;
}

function firstFile_(files) {
  for (var key in files) {
    if (Object.prototype.hasOwnProperty.call(files, key)) {
      return files[key];
    }
  }
  return null;
}

function parseInlineFileFromFields_(fields) {
  var fileBase64 = stringOrEmpty_(fields.file_base64);
  if (!fileBase64) {
    return { file: null, error: null };
  }

  var normalized = String(fileBase64 || "").trim();
  normalized = normalized.replace(/^data:[^;]+;base64,/i, "");
  normalized = normalized.replace(/\s+/g, "");
  if (!normalized) {
    return { file: null, error: "file_base64 is empty" };
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(normalized);
  } catch (_error) {
    return { file: null, error: "file_base64 is invalid" };
  }

  if (!bytes || !bytes.length) {
    return { file: null, error: "file_base64 has no bytes" };
  }

  var fileName = sanitizeFileName_(stringOrEmpty_(fields.file_name) || "upload.bin");
  var mime = String(fields.file_mime || "").trim().toLowerCase() || "application/octet-stream";

  return {
    file: {
      name: fileName,
      mime: mime,
      bytes: bytes,
    },
    error: null,
  };
}

function normalizeFileIds_(value) {
  if (Array.isArray(value)) {
    return value
      .map(function (item) { return String(item || "").trim(); })
      .filter(function (item) { return !!item; });
  }

  var raw = String(value || "").trim();
  if (!raw) return [];

  return raw
    .split(/[\n,\s]+/)
    .map(function (item) { return String(item || "").trim(); })
    .filter(function (item) { return !!item; });
}

function normalizeStringArray_(value) {
  if (!Array.isArray(value)) return [];
  var result = [];
  for (var i = 0; i < value.length; i += 1) {
    result.push(String(value[i] || "").trim().toLowerCase());
  }
  return result.filter(function (item) { return !!item; });
}

function sanitizeFileName_(value) {
  var name = String(value || "").trim();
  if (!name) return "upload.bin";
  name = name.replace(/^.*[\\\/]/, "");
  name = name.replace(/[\r\n\t]/g, " ");
  return name.substring(0, 180);
}

function getRequiredScriptProperty_(name) {
  var value = getOptionalScriptProperty_(name);
  if (!value) {
    throw new Error("Missing required script property: " + name);
  }
  return value;
}

function getOptionalScriptProperty_(name) {
  return String(PropertiesService.getScriptProperties().getProperty(name) || "").trim();
}

function toInteger_(value) {
  var parsed = Number(value);
  if (!isFinite(parsed)) return 0;
  return Math.floor(parsed);
}

function currentUnixSeconds_() {
  return Math.floor(Date.now() / 1000);
}

function stringOrEmpty_(value) {
  return String(value || "").trim();
}

function errorPayload_(code, message) {
  return {
    ok: false,
    error: {
      code: String(code || "error"),
      message: String(message || "Error"),
    },
  };
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function createSignedToken_(payload, secret) {
  var payloadBytes = Utilities.newBlob(JSON.stringify(payload)).getBytes();
  var payloadEncoded = base64UrlEncode_(payloadBytes);
  var signature = signPayloadBase64Url_(payloadEncoded, secret);
  return payloadEncoded + "." + signature;
}

function verifySignedToken_(token, secret) {
  var parts = String(token || "").split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "Token format is invalid" };
  }

  var payloadEncoded = parts[0];
  var signature = parts[1];
  var expected = signPayloadBase64Url_(payloadEncoded, secret);
  if (!safeEqual_(signature, expected)) {
    return { ok: false, reason: "Token signature is invalid" };
  }

  var payloadJson;
  try {
    var payloadBytes = base64UrlDecode_(payloadEncoded);
    payloadJson = JSON.parse(Utilities.newBlob(payloadBytes).getDataAsString("UTF-8"));
  } catch (_error) {
    return { ok: false, reason: "Token payload is invalid" };
  }

  var exp = toInteger_(payloadJson && payloadJson.exp);
  if (exp > 0 && exp < currentUnixSeconds_()) {
    return { ok: false, reason: "Token expired" };
  }

  return { ok: true, payload: payloadJson };
}

function signPayloadBase64Url_(payloadEncoded, secret) {
  var signatureBytes = Utilities.computeHmacSha256Signature(
    payloadEncoded,
    secret,
    Utilities.Charset.UTF_8,
  );
  return base64UrlEncode_(signatureBytes);
}

function base64UrlEncode_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function base64UrlDecode_(value) {
  var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) {
    normalized += "=";
  }
  return Utilities.base64Decode(normalized);
}

function safeEqual_(a, b) {
  var left = String(a || "");
  var right = String(b || "");
  if (left.length !== right.length) return false;

  var mismatch = 0;
  for (var i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}
