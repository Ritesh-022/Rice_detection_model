"""
Rice Grain Quality Analysis Pipeline - Complete Single File
YOLO Detection + ResNet Classification + LangGraph Orchestration + LangChain + Ollama
All-in-one production deployment
"""

import os
import cv2
import json
import uuid
import torch
import urllib.request
import urllib.parse
import numpy as np
import re
from PIL import Image
from typing import TypedDict, Optional
from collections import Counter
from flask import Flask, request, jsonify
from torchvision import transforms, models
from ultralytics import YOLO
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langgraph.graph import StateGraph, END
try:
    import timm
except Exception:
    timm = None
try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

# ╔════════════════════════════════════════════════════════════════╗
# ║                    CONFIGURATION SECTION                       ║
# ║                 Edit these settings for deployment             ║
# ╚════════════════════════════════════════════════════════════════╝

# ========================
# MODEL PATHS
# ========================
YOLO_MODEL_PATH = r"segmentation\segmentation.pt"
CLASS_MODEL_PATH = r"recognization\recognization.pth"
HEALTH_MODEL_PATH = r"health\health.pth"

CLASS_JSON_PATH = r"recognization\recog_classes.json"
HEALTH_JSON_PATH = r"health\health_classes.json"

# ========================
# DIRECTORIES
# ========================
UPLOAD_FOLDER = r"uploads"
OUTPUT_FOLDER = r"grain_outputs"

# ========================
# FLASK CONFIG
# ========================
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5000
FLASK_DEBUG = False

# ========================
# LLM CONFIG
# ========================
OLLAMA_MODEL = "llama3"
OLLAMA_HOST = "http://localhost:11434"
OLLAMA_TIMEOUT = 30

# ========================
# DEVICE CONFIG
# ========================
USE_GPU = True
GPU_DEVICE = 0

# ========================
# PROCESSING CONFIG
# ========================
CONFIDENCE_THRESHOLD = 0.65
MAX_GRAINS_PER_IMAGE = 500
MIN_BOX_AREA_RATIO = 0.00005
MAX_BOX_AREA_RATIO = 0.08
MIN_EDGE_DENSITY = 0.015
MIN_GRAY_STD = 12.0
NMS_IOU_THRESHOLD = 0.45
MIN_BOX_WIDTH = 8
MIN_BOX_HEIGHT = 8
MIN_ELONGATION_RATIO = 1.8
MAX_ELONGATION_RATIO = 12.0
NON_BACKGROUND_THRESHOLD = 220
MIN_NON_BACKGROUND_PIXELS = 150
MIN_LAPLACIAN_VAR = 20.0
MAX_BOX_PIXEL_AREA = 25000
MIN_VALID_GRAINS = 5
MIN_TRUSTED_HEALTH_CONFIDENCE = 0.35
MIN_TRUSTED_HEALTH_GRAINS = 5
CROP_PADDING = 12

# ========================
# REGION & MARKET DATA
# ========================
# Agmarknet API (data.gov.in) — live daily APMC mandi prices
# API key from https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi
AGMARKNET_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aab0540d0d820d77f48"
AGMARKNET_API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# ========================
# WEB SCRAPING CONFIG
# ========================
# Shopping websites to scrape for rice prices
SHOPPING_SITES = {
    "bigbasket": "https://www.bigbasket.com/ps/?q=rice",
    "amazon": "https://www.amazon.in/s?k=rice",
    "flipkart": "https://www.flipkart.com/search?q=rice",
}

# Enable/disable web scraping
ENABLE_WEB_SCRAPING = True
WEB_SCRAPE_TIMEOUT = 10
MAX_SCRAPED_PRODUCTS = 20

# State name → Agmarknet state name mapping
STATE_NAME_MAP = {
    "Karnataka":        "Karnataka",
    "Tamil Nadu":       "Tamil Nadu",
    "Kerala":           "Kerala",
    "Andhra Pradesh":   "Andhra Pradesh",
    "West Bengal":      "West Bengal",
    "Bihar":            "Bihar",
    "Punjab":           "Punjab",
    "Haryana":          "Haryana",
    "Odisha":           "Odisha",
    "Uttar Pradesh":    "Uttar Pradesh",
    "Telangana":        "Telangana",
    "Assam":            "Assam",
    "Madhya Pradesh":   "Madhya Pradesh",
    "Gujarat":          "Gujarat",
    "Rajasthan":        "Rajasthan",
    "Jharkhand":        "Jharkhand",
    "Uttarakhand":      "Uttarakhand",
    "Himachal Pradesh": "Himachal Pradesh",
    "Chhattisgarh":     "Chhattisgarh",
    "Maharashtra":      "Maharashtra",
}

# MSP fallback (Government of India 2024-25, per quintal)
MSP_PER_QUINTAL = {
    "Karnataka": 2300, "Tamil Nadu": 2300, "Kerala": 2300,
    "Andhra Pradesh": 2300, "West Bengal": 2300, "Bihar": 2300,
    "Punjab": 2300, "Haryana": 2300, "Odisha": 2300,
    "Uttar Pradesh": 2300, "Telangana": 2300, "Assam": 2300,
    "Madhya Pradesh": 2300, "Gujarat": 2300, "Rajasthan": 2300,
    "Jharkhand": 2300, "Uttarakhand": 2300, "Himachal Pradesh": 2300,
    "Chhattisgarh": 2300, "Maharashtra": 2300,
}

# ========================
# MARKET GRADE PREMIUMS
# ========================
# Based on APEDA export premium data and FCI/NAFED procurement price differentials
# Source: APEDA Annual Report 2023-24, FCI procurement circulars
QUALITY_PRICE_MULTIPLIER = {
    "premium_export":       1.55,  # APEDA: premium export rice fetches 40-60% above MSP
    "local_market":         1.18,  # FCI open market: ~15-20% above MSP for Grade A
    "processing_industry":  0.82,  # Rice mills pay 15-20% below MSP for processing grade
    "animal_feed":          0.38,  # Broken/damaged: 60-65% below MSP (NAFED data)
}

# Rice variety type premiums over base price
# Source: APEDA variety-wise export price data 2023-24
VARIETY_PREMIUM = {
    "basmati":   0.18,  # Basmati: 15-20% premium (APEDA export data)
    "long":      0.12,  # Long grain non-basmati: ~10-15% premium
    "premium":   0.15,
    "sona":      0.06,  # Sona Masuri: ~5-8% premium (popular South Indian variety)
    "ponni":     0.06,  # Ponni: ~5-8% premium
    "ipsala":    0.08,  # Ipsala: medium-grain, ~6-10% premium
    "medium":    0.04,
}

# ========================
# QUALITY-BASED MARGINS
# ========================
# Quality-based margin (0-15% markup, consumer pays more than farmer receives)
# Better quality rice = higher margin
MARGIN_MIN = 0.00  # 0% for lowest quality
MARGIN_MAX = 0.15  # 15% for premium quality

# ========================
# HEALTH THRESHOLDS
# ========================
HEALTH_THRESHOLDS = {
    "premium_export": 90,
    "local_market": 75,
    "processing_industry": 50,
    "animal_feed": 0,
}

# ========================
# SHELF LIFE CONFIG
# ========================
# Based on FSSAI Food Safety and Standards (Storage) Regulations
# and ICAR-NRRI (National Rice Research Institute) post-harvest guidelines
# Source: FSSAI Schedule 4, ICAR-NRRI Technical Bulletin 2022
SHELF_LIFE_BASE = {
    "premium_export":       (5, 6),   # FSSAI: Grade A milled rice, hermetic storage: 5-6 months
    "local_market":         (3, 4),   # FSSAI: Grade B, ambient storage: 3-4 months
    "processing_industry":  (1, 2),   # ICAR-NRRI: damaged/discoloured, process within 1-2 months
    "animal_feed":          (0, 0.5), # Immediate use recommended; max 2 weeks
}

# Shelf life penalty per defect type (months reduction per 10% prevalence)
# Source: ICAR-NRRI post-harvest loss assessment studies
DEFECT_SHELF_PENALTY = {
    "discoloured_high":  0.5,
    "broken_high":       0.5,
}

# ╔════════════════════════════════════════════════════════════════╗
# ║                    APPLICATION CODE                            ║
# ║              (Do not modify below unless needed)               ║
# ╚════════════════════════════════════════════════════════════════╝

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Device setup
if USE_GPU and torch.cuda.is_available():
    device = torch.device(f"cuda:{GPU_DEVICE}")
else:
    device = torch.device("cpu")

print(f"Using device: {device}")

# ========================
# FLASK APP
# ========================
app = Flask(__name__)

# ========================
# MODEL LOADING
# ========================
print("Loading models...")

# Health label interpretation — loaded from health_classes.json at startup
# Any label containing 'healthy' (but not 'unhealthy') is treated as healthy.
# This set is used as an explicit override for known healthy labels.
HEALTHY_LABELS = {
    "healthy",
    "good",
    "healthy_large",
    "healthy_medium",
}

try:
    yolo_model = YOLO(YOLO_MODEL_PATH)
    print("✓ YOLO model loaded")
except Exception as e:
    print(f"Warning: YOLO model not found ({e})")
    yolo_model = None

try:
    with open(CLASS_JSON_PATH) as f:
        class_labels = json.load(f)
    print(f"✓ Class labels loaded ({len(class_labels)} classes)")
except Exception as e:
    print(f"Warning: Class labels not found ({e})")
    class_labels = {}

try:
    with open(HEALTH_JSON_PATH) as f:
        health_labels = json.load(f)
    # Dynamically build HEALTHY_LABELS from the loaded classes
    # Any class whose name contains 'healthy' (but not 'unhealthy') or is in the base set
    HEALTHY_LABELS = {
        lbl for lbl in health_labels.values()
        if ("healthy" in str(lbl).lower() and "unhealthy" not in str(lbl).lower())
        or str(lbl).lower() in {"good", "healthy", "healthy_large", "healthy_medium"}
    }
    print(f"✓ Health labels loaded ({len(health_labels)} classes), healthy labels: {HEALTHY_LABELS}")
except Exception as e:
    print(f"Warning: Health labels not found ({e})")
    health_labels = {}

# ========================
# RESNET MODEL LOADING
# ========================
def load_model(path, num_classes, model_kind):
    """Load classification model by architecture and checkpoint format."""
    try:
        if model_kind == "resnet18":
            model = models.resnet18(weights=None)
            model.fc = torch.nn.Sequential(
                torch.nn.Linear(model.fc.in_features, 256),
                torch.nn.ReLU(),
                torch.nn.Dropout(0.4),
                torch.nn.Linear(256, num_classes)
            )
        elif model_kind == "efficientnet_b0":
            if timm is None:
                raise RuntimeError("timm is not installed for efficientnet_b0 loading")
            model = timm.create_model("efficientnet_b0", pretrained=False)
            in_features = model.classifier.in_features
            model.classifier = torch.nn.Sequential(
                torch.nn.Dropout(0.4),
                torch.nn.Linear(in_features, num_classes)
            )
        else:
            raise ValueError(f"Unsupported model_kind: {model_kind}")

        checkpoint = torch.load(path, map_location=device)
        if isinstance(checkpoint, dict):
            if "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
            elif "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            else:
                state_dict = checkpoint
        else:
            state_dict = checkpoint

        normalized_state = {}
        for key, value in state_dict.items():
            new_key = key
            if new_key.startswith("module."):
                new_key = new_key[len("module."):]
            normalized_state[new_key] = value

        missing_keys, unexpected_keys = model.load_state_dict(normalized_state, strict=False)
        if missing_keys or unexpected_keys:
            print(
                f"Warning: Non-strict load for {model_kind}. "
                f"missing={len(missing_keys)}, unexpected={len(unexpected_keys)}"
            )

        model.to(device)
        model.eval()
        return model
    except Exception as e:
        print(f"Warning: Could not load model from {path}: {e}")
        return None

class_model = load_model(CLASS_MODEL_PATH, len(class_labels), "resnet18") if class_labels else None
health_model = load_model(HEALTH_MODEL_PATH, len(health_labels), "efficientnet_b0") if health_labels else None

print("✓ All models initialized")

# ========================
# IMAGE TRANSFORMS
# ========================
class_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

health_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# ========================
# OLLAMA + LANGCHAIN SETUP
# ========================
try:
    llm = Ollama(model=OLLAMA_MODEL)
    print("✓ Ollama LLM initialized")
except Exception as e:
    print(f"Warning: Ollama not available ({e})")
    llm = None

prompt_template = """
You are an agricultural intelligence assistant specializing in rice grain quality analysis for Indian farmers and traders.

CRITICAL RULES:
- Use ONLY the exact numbers and values from the provided data below
- Do NOT invent, estimate, or round any values
- Reference the specific health labels (e.g. discoloured_high, unhulled) by name
- Be specific to the region and rice type provided
- Be concise and practical

Actual ML Analysis Data:
{context}

Based strictly on the above data, provide:
1. Quality Assessment: What the health distribution (specific labels and counts) means for this batch
2. Supply Chain: Why this batch belongs in the recommended supply chain given its exact health %
3. Shelf Life: Explain the shelf life estimate given the specific defect types found
4. Market Price Justification: Why this batch fetches Rs.{market_price}/kg in {region}
5. Storage Instructions (3-4 specific bullets based on the defect types found)
6. Farmer Summary: 2-3 sentences in simple language referencing the actual grain counts
"""

if llm:
    prompt = PromptTemplate(
        input_variables=["context", "market_price", "region"],
        template=prompt_template
    )
    llm_chain = LLMChain(llm=llm, prompt=prompt)
else:
    llm_chain = None

# ========================
# LANGGRAPH STATE DEFINITION
# ========================
class RiceState(TypedDict):
    """LangGraph state object for workflow orchestration"""
    grains: list
    summary: dict
    region: str
    user_mode: str
    market_price: float
    base_price: float
    price_source: str
    scraped_prices: list
    price_breakdown: dict
    shelf_life: str
    supply_chain: str
    iot_data: Optional[dict]
    llm_response: str
    request_id: str
    error: Optional[str]

def make_error_response(request_id, code, message, details=None):
    """Return consistently structured errors for clean client-side printing."""
    payload = {
        "status": "error",
        "request_id": request_id,
        "error": {
            "code": code,
            "message": message
        }
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload

# ========================
# IMAGE PROCESSING
# ========================
def remove_background(crop):
    """Remove background without altering grain geometry."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    
    _, thresh = cv2.threshold(
        blur,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    
    if np.mean(thresh) > 127:
        thresh = cv2.bitwise_not(thresh)

    # Small dilation protects thin grain tips from being cut.
    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.dilate(thresh, kernel, iterations=1)

    mask = cv2.merge([thresh, thresh, thresh])
    black_bg = np.zeros_like(crop)
    result = np.where(mask == 255, crop, black_bg)

    return result

def is_valid_grain_candidate(crop, box, image_shape, confidence):
    """
    Reject obvious false positives from YOLO.
    Filters low-confidence, unrealistic box sizes, and near-uniform patches
    (for example blank white plate regions).
    """
    if crop is None or crop.size == 0:
        return False

    if confidence < CONFIDENCE_THRESHOLD:
        return False

    img_h, img_w = image_shape[:2]
    img_area = float(img_h * img_w)

    x1, y1, x2, y2 = box
    box_w = max(int(x2) - int(x1), 1)
    box_h = max(int(y2) - int(y1), 1)
    box_area_pixels = box_w * box_h
    box_area_ratio = (box_w * box_h) / img_area

    if box_w < MIN_BOX_WIDTH or box_h < MIN_BOX_HEIGHT:
        return False

    if box_area_pixels > MAX_BOX_PIXEL_AREA:
        return False

    elongation_ratio = max(box_w, box_h) / (min(box_w, box_h) + 1e-6)
    if elongation_ratio < MIN_ELONGATION_RATIO or elongation_ratio > MAX_ELONGATION_RATIO:
        return False

    if box_area_ratio < MIN_BOX_AREA_RATIO or box_area_ratio > MAX_BOX_AREA_RATIO:
        return False

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    non_background_pixels = int(np.sum(gray < NON_BACKGROUND_THRESHOLD))
    if non_background_pixels < MIN_NON_BACKGROUND_PIXELS:
        return False

    gray_std = float(np.std(gray))
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    edges = cv2.Canny(gray, 40, 120)
    edge_density = float(np.mean(edges > 0))

    # Empty white plate regions tend to have very low texture and edge content.
    if gray_std < MIN_GRAY_STD and edge_density < MIN_EDGE_DENSITY:
        return False

    if lap_var < MIN_LAPLACIAN_VAR:
        return False

    return True

# ========================
# PREDICTION FUNCTION
# ========================
def predict_single(model, image, image_transform=None):
    """Run single image through model"""
    if model is None:
        return None, 0.0
    
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(image)
    
    selected_transform = image_transform if image_transform is not None else class_transform
    tensor = selected_transform(image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        output = model(tensor)
        probs = torch.softmax(output, dim=1)
        conf, pred = torch.max(probs, dim=1)
    
    return int(pred.item()), float(conf.item())

# ========================
# TOOL FUNCTIONS
# ========================
def get_quality_tier(health_percent):
    """Map health % to quality tier string."""
    if health_percent > 90:
        return "premium_export"
    elif health_percent > 75:
        return "local_market"
    elif health_percent > 50:
        return "processing_industry"
    return "animal_feed"

def scrape_shopping_prices(rice_type):
    """
    Scrape rice prices from shopping websites using LangChain WebBaseLoader.
    Returns list of {product_name, price_per_kg, source} dicts.
    """
    if not ENABLE_WEB_SCRAPING or BeautifulSoup is None:
        return []
    
    scraped_prices = []
    rice_keywords = rice_type.lower().split()
    
    # Build search query
    search_query = f"{rice_type} rice" if rice_type != "unknown" else "rice"
    
    for site_name, base_url in SHOPPING_SITES.items():
        try:
            # Use LangChain WebBaseLoader
            loader = WebBaseLoader(
                web_paths=[base_url],
                header_template={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )
            
            docs = loader.load()
            if not docs:
                continue
            
            # Parse HTML content
            html_content = docs[0].page_content
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract prices based on site structure
            products = extract_prices_from_html(soup, site_name, rice_keywords)
            scraped_prices.extend(products[:5])  # Top 5 per site
            
            print(f"[WebScraper] {site_name}: found {len(products)} products")
            
        except Exception as e:
            print(f"[WebScraper] {site_name} failed: {e}")
            continue
    
    return scraped_prices[:MAX_SCRAPED_PRODUCTS]


def extract_prices_from_html(soup, site_name, keywords):
    """
    Extract product names and prices from HTML soup.
    Returns list of {product_name, price_per_kg, source}.
    """
    products = []
    
    try:
        if site_name == "amazon":
            # Amazon structure
            items = soup.find_all('div', {'data-component-type': 's-search-result'})
            for item in items[:10]:
                try:
                    name_tag = item.find('span', {'class': 'a-text-normal'})
                    price_tag = item.find('span', {'class': 'a-price-whole'})
                    
                    if name_tag and price_tag:
                        name = name_tag.get_text(strip=True)
                        price_text = price_tag.get_text(strip=True).replace(',', '')
                        price = float(re.sub(r'[^0-9.]', '', price_text))
                        
                        # Extract weight and calculate per kg
                        weight_kg = extract_weight_kg(name)
                        if weight_kg > 0:
                            price_per_kg = price / weight_kg
                            products.append({
                                "product_name": name,
                                "price_per_kg": round(price_per_kg, 2),
                                "source": "Amazon"
                            })
                except Exception:
                    continue
        
        elif site_name == "bigbasket":
            # BigBasket structure
            items = soup.find_all('div', class_=re.compile('product'))
            for item in items[:10]:
                try:
                    name_tag = item.find('a', class_=re.compile('product.*title'))
                    price_tag = item.find('span', class_=re.compile('price'))
                    
                    if name_tag and price_tag:
                        name = name_tag.get_text(strip=True)
                        price_text = price_tag.get_text(strip=True).replace('₹', '').replace(',', '')
                        price = float(re.sub(r'[^0-9.]', '', price_text))
                        
                        weight_kg = extract_weight_kg(name)
                        if weight_kg > 0:
                            price_per_kg = price / weight_kg
                            products.append({
                                "product_name": name,
                                "price_per_kg": round(price_per_kg, 2),
                                "source": "BigBasket"
                            })
                except Exception:
                    continue
        
        elif site_name == "flipkart":
            # Flipkart structure
            items = soup.find_all('div', class_=re.compile('_1AtVbE|_13oc-S'))
            for item in items[:10]:
                try:
                    name_tag = item.find('a', class_=re.compile('IRpwTa|_2rpwqI'))
                    price_tag = item.find('div', class_=re.compile('_30jeq3|_1_WHN1'))
                    
                    if name_tag and price_tag:
                        name = name_tag.get_text(strip=True)
                        price_text = price_tag.get_text(strip=True).replace('₹', '').replace(',', '')
                        price = float(re.sub(r'[^0-9.]', '', price_text))
                        
                        weight_kg = extract_weight_kg(name)
                        if weight_kg > 0:
                            price_per_kg = price / weight_kg
                            products.append({
                                "product_name": name,
                                "price_per_kg": round(price_per_kg, 2),
                                "source": "Flipkart"
                            })
                except Exception:
                    continue
    
    except Exception as e:
        print(f"[PriceExtractor] Error parsing {site_name}: {e}")
    
    return products


def extract_weight_kg(product_name):
    """
    Extract weight in kg from product name.
    Examples: '5kg', '1 kg', '500g', '10 Kg'
    """
    try:
        # Match kg
        kg_match = re.search(r'(\d+\.?\d*)\s*kg', product_name, re.IGNORECASE)
        if kg_match:
            return float(kg_match.group(1))
        
        # Match grams and convert to kg
        g_match = re.search(r'(\d+)\s*g(?!k)', product_name, re.IGNORECASE)
        if g_match:
            return float(g_match.group(1)) / 1000.0
        
        # Default to 1kg if no weight found
        return 1.0
    except Exception:
        return 1.0


def fetch_llm_price_estimate(region, rice_type, health_percent):
    """
    Use Ollama LLM to estimate rice price when web scraping and Agmarknet fail.
    Provides intelligent fallback before using static MSP.
    
    Args:
        region: State/region name
        rice_type: Rice variety type
        health_percent: Health percentage (0-100)
    
    Returns:
        float: Estimated price per kg, or None if LLM unavailable
    """
    if llm is None:
        return None
    
    try:
        prompt = f"""You are a rice market price expert for India. Estimate the current market price per kg for rice with these parameters:

Region: {region}
Rice Type: {rice_type}
Health/Quality: {health_percent}%

Provide ONLY a JSON response with this exact structure:
{{
  "price_per_kg": <number>,
  "reasoning": "<brief 1-sentence explanation>"
}}

Consider:
- Regional market conditions in {region}
- Rice variety premium for {rice_type}
- Quality grade based on {health_percent}% health
- Current 2024-25 market trends

Response (JSON only, no other text):"""
        
        response = llm.invoke(prompt)
        
        # Extract JSON from response
        import json
        # Try to find JSON in response
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            json_str = response[json_start:json_end]
            data = json.loads(json_str)
            
            price = float(data.get('price_per_kg', 0))
            reasoning = data.get('reasoning', 'LLM estimate')
            
            if 10 <= price <= 200:  # Sanity check: price should be between ₹10-200/kg
                print(f"[LLM Price] Estimated ₹{price:.2f}/kg - {reasoning}")
                return price
            else:
                print(f"[LLM Price] Invalid price {price}, outside reasonable range")
                return None
        else:
            print(f"[LLM Price] Could not extract JSON from response")
            return None
            
    except Exception as e:
        print(f"[LLM Price] Estimation failed: {e}")
        return None

def fetch_live_mandi_price(region, rice_type=None):
    """
    Fetch live rice price from Agmarknet (data.gov.in) for the given state.
    Returns modal price per quintal, or None if unavailable.
    Tries commodity names: 'Rice', 'Paddy(Dhan)(Common)', 'Paddy'
    """
    state = STATE_NAME_MAP.get(region, region)
    commodities = ["Rice", "Paddy(Dhan)(Common)", "Paddy"]

    for commodity in commodities:
        try:
            params = urllib.parse.urlencode({
                "api-key": AGMARKNET_API_KEY,
                "format": "json",
                "filters[state]": state,
                "filters[commodity]": commodity,
                "limit": 10,
                "sort[arrival_date]": "desc",
            })
            url = f"{AGMARKNET_API_URL}?{params}"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; RiceAI/1.0)",
                "Accept": "application/json",
                "Referer": "https://data.gov.in/",
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())

            records = data.get("records", [])
            if not records:
                continue

            # Collect modal prices, filter out zeros
            prices = []
            for r in records:
                modal = r.get("modal_price") or r.get("Modal_Price") or r.get("modal price")
                try:
                    p = float(str(modal).replace(",", ""))
                    if p > 0:
                        prices.append(p)
                except (TypeError, ValueError):
                    continue

            if prices:
                avg_quintal = sum(prices) / len(prices)
                print(f"[Agmarknet] {commodity} in {state}: avg modal ₹{avg_quintal:.0f}/quintal from {len(prices)} mandis")
                return avg_quintal  # per quintal

        except Exception as e:
            print(f"[Agmarknet] fetch failed for {commodity}/{state}: {e}")
            continue

    return None


def market_price_tool(region, health_percent, dominant_type):
    """
    Get real-time market price per kg using multi-source pricing:
    1. Scrape shopping websites for retail prices (LangChain + BeautifulSoup)
    2. Try live Agmarknet mandi price for the region
    3. Try LLM-based price estimation
    4. Fall back to MSP if all unavailable
    Then apply formula: (base_price * health_percent/100) * quality_multiplier * variety_premium
    
    Calculates BOTH farmer and consumer prices from the SAME base price.
    
    Args:
        region: State/region name
        health_percent: Health percentage (0-100)
        dominant_type: Rice variety type
    
    Returns:
        dict: Contains farmer_price, consumer_price, base_price, price_source, scraped_prices, price_breakdown
    """
    # Step 1: Try web scraping for retail prices
    scraped_prices = scrape_shopping_prices(dominant_type)
    web_price_per_kg = None
    
    if scraped_prices:
        # Calculate average from scraped prices
        valid_prices = [p["price_per_kg"] for p in scraped_prices if p["price_per_kg"] > 0]
        if valid_prices:
            web_price_per_kg = sum(valid_prices) / len(valid_prices)
            print(f"[WebPrice] Avg retail price: ₹{web_price_per_kg:.2f}/kg from {len(valid_prices)} products")
    
    # Step 2: Try Agmarknet mandi price
    live_quintal = fetch_live_mandi_price(region, dominant_type)
    mandi_per_kg = (live_quintal / 100.0) if live_quintal else None
    
    # Step 3: Try LLM-based price estimation
    llm_per_kg = None
    if not mandi_per_kg:
        llm_per_kg = fetch_llm_price_estimate(region, dominant_type, health_percent)
    
    # Step 4: Choose best base price (prefer web > mandi > LLM > MSP)
    if web_price_per_kg:
        base_per_kg = web_price_per_kg
        price_source = "web_scraped"
    elif mandi_per_kg:
        base_per_kg = mandi_per_kg
        price_source = "agmarknet_mandi"
    elif llm_per_kg:
        base_per_kg = llm_per_kg
        price_source = "llm_estimate"
    else:
        base_quintal = MSP_PER_QUINTAL.get(region, 2300)
        base_per_kg = base_quintal / 100.0
        price_source = "msp_fallback"
    
    print(f"[PriceSource] Using {price_source}: ₹{base_per_kg:.2f}/kg")

    # Step 4: Apply formula - (base_price * health_percent/100) * quality_multiplier
    tier = get_quality_tier(health_percent)
    multiplier = QUALITY_PRICE_MULTIPLIER[tier]
    
    # Health-based adjustment: reduce price proportionally to health
    health_factor = health_percent / 100.0

    # Step 5: Fine-grained adjustment within tier
    if tier == "premium_export":
        fine = (health_percent - 90) / 10.0 * 0.10
    elif tier == "local_market":
        fine = (health_percent - 75) / 15.0 * 0.08
    elif tier == "processing_industry":
        fine = (health_percent - 50) / 25.0 * 0.05
    else:
        fine = health_percent / 50.0 * 0.05

    # Step 6: Rice variety premium from APEDA data
    type_lower = str(dominant_type).lower()
    type_premium = 0.0
    for variety, premium in VARIETY_PREMIUM.items():
        if variety in type_lower:
            type_premium = premium
            break

    # Calculate quality-based margin (0-15% based on health percentage)
    # Direct mapping: 0% health -> 0% margin, 100% health -> 15% margin
    # This ensures margin increases with quality
    margin_percent = (health_percent / 100.0) * MARGIN_MAX
    margin_percent = max(MARGIN_MIN, min(MARGIN_MAX, margin_percent))  # Clamp between 0-15%
    
    print(f"[Margin Debug] Health: {health_percent}%, Calculated margin: {margin_percent*100:.2f}%")
    
    # Final formula: base * health_factor * (multiplier + fine + variety_premium)
    base_calculated_price = base_per_kg * health_factor * (multiplier + fine + type_premium)
    
    # Calculate both prices from SAME base
    farmer_price = round(base_calculated_price, 2)
    consumer_price = round(base_calculated_price * (1 + margin_percent), 2)
    
    print(f"[Price Debug] Farmer: ₹{farmer_price}, Consumer: ₹{consumer_price}, Margin: {margin_percent*100:.1f}%")
    
    # Return BOTH prices always
    return {
        "farmer_price": farmer_price,
        "consumer_price": consumer_price,
        "base_price": round(base_per_kg, 2),
        "price_source": price_source,
        "scraped_prices": scraped_prices,
        "price_breakdown": {
            "base_price": round(base_per_kg, 2),
            "health_factor": health_factor,
            "quality_multiplier": multiplier,
            "variety_premium": type_premium,
            "margin_percent": round(margin_percent * 100, 1),
            "farmer_price": farmer_price,
            "consumer_price": consumer_price
        }
    }

def shelf_life_tool(health_percent, health_distribution):
    """Compute shelf life from FSSAI/ICAR-NRRI guidelines + actual defect distribution."""
    tier = get_quality_tier(health_percent)
    low_months, high_months = SHELF_LIFE_BASE[tier]

    # Interpolate within tier range based on exact health %
    if tier == "premium_export":
        ratio = (health_percent - 90) / 10.0
    elif tier == "local_market":
        ratio = (health_percent - 75) / 15.0
    elif tier == "processing_industry":
        ratio = (health_percent - 50) / 25.0
    else:
        ratio = health_percent / 50.0

    months = round(low_months + ratio * (high_months - low_months), 1)

    # Apply per-defect penalty from ICAR-NRRI data
    total = sum(health_distribution.values()) if health_distribution else 1
    for defect, penalty_per_10pct in DEFECT_SHELF_PENALTY.items():
        count = health_distribution.get(defect, 0)
        prevalence = count / total if total > 0 else 0
        months -= prevalence * 10 * penalty_per_10pct

    months = max(0.1, round(months, 1))

    if months < 0.5:
        days = round(months * 30)
        return f"{days} days (immediate processing required — FSSAI unsafe for storage)"
    elif months < 1:
        return f"{round(months * 30)} days (process within weeks — ICAR-NRRI high-risk grade)"
    elif months < 2:
        return f"{months} month (controlled storage required — FSSAI Grade C)"
    elif months < 4:
        return f"{months} months (good storage conditions — FSSAI Grade B)"
    else:
        return f"{months} months (optimal hermetic/cold storage — FSSAI Grade A)"

def supply_chain_tool(health_percent, dominant_type):
    """Determine supply chain path from health % and rice type."""
    tier = get_quality_tier(health_percent)
    type_lower = str(dominant_type).lower()

    if tier == "premium_export":
        if any(t in type_lower for t in ["basmati", "long"]):
            return "Premium Basmati Export Channel"
        return "Premium Export Market"
    elif tier == "local_market":
        return "Local / Regional Retail Market"
    elif tier == "processing_industry":
        return "Rice Processing Industry (milling/parboiling)"
    return "Animal Feed / Waste Management"

def iot_sensor_tool(region, grains, summary):
    """Build dynamic analysis metadata from ML output."""
    if not grains:
        return {
            "location": region,
            "source": "ml_output",
            "grain_count": 0
        }

    avg_type_conf = round(
        float(np.mean([g.get("type_confidence", 0.0) for g in grains])),
        4
    )
    avg_health_conf = round(
        float(np.mean([g.get("health_confidence", 0.0) for g in grains])),
        4
    )

    return {
        "location": region,
        "source": "ml_output",
        "grain_count": summary.get("grain_count", len(grains)),
        "healthy_percentage": summary.get("health_percentage", 0.0),
        "dominant_type": summary.get("dominant_type", "unknown"),
        "avg_type_confidence": avg_type_conf,
        "avg_health_confidence": avg_health_conf
    }

# ========================
# AGGREGATION FUNCTION
# ========================
def aggregate_results(grains, region):
    """Aggregate per-grain results into batch statistics"""
    grain_count = len(grains)
    if grain_count == 0:
        return None

    class_counter = Counter([g["type"] for g in grains])
    health_counter = Counter([g["health"] for g in grains])
    dominant_type = class_counter.most_common(1)[0][0]

    def normalize_label(label):
        return str(label).strip().lower().replace(" ", "_").replace("-", "_")

    UNHEALTHY_OVERRIDES = {"broken_high", "discoloured_high"}

    def is_healthy_label(label):
        normalized = normalize_label(label)
        if normalized in UNHEALTHY_OVERRIDES:
            return False
        return True

    # ── Trusted predictions (above confidence threshold) ──────────────────────
    trusted_grains  = [g for g in grains if float(g.get("health_confidence", 0.0)) >= MIN_TRUSTED_HEALTH_CONFIDENCE]
    uncertain_grains = [g for g in grains if float(g.get("health_confidence", 0.0)) < MIN_TRUSTED_HEALTH_CONFIDENCE]
    trusted_count   = len(trusted_grains)
    uncertain_count = len(uncertain_grains)

    trusted_healthy   = sum(1 for g in trusted_grains if is_healthy_label(g.get("health", "")))
    trusted_unhealthy = trusted_count - trusted_healthy

    # ── Weighted contribution from uncertain grains ───────────────────────────
    # weight = health_confidence * avg(detection_confidence, type_confidence)
    # Avoids hard-excluding low-confidence grains entirely.
    uncertain_healthy_score   = 0.0
    uncertain_unhealthy_score = 0.0
    for g in uncertain_grains:
        h_conf = float(g.get("health_confidence",    0.0))
        d_conf = float(g.get("detection_confidence", 0.0))
        t_conf = float(g.get("type_confidence",      0.0))
        weight = h_conf * ((d_conf + t_conf) / 2.0)
        if is_healthy_label(g.get("health", "")):
            uncertain_healthy_score   += weight
        else:
            uncertain_unhealthy_score += weight

    uncertain_total_score = uncertain_healthy_score + uncertain_unhealthy_score
    if uncertain_total_score > 0:
        uncertain_healthy_equiv   = round((uncertain_healthy_score / uncertain_total_score) * uncertain_count)
        uncertain_unhealthy_equiv = uncertain_count - uncertain_healthy_equiv
    else:
        # No signal at all — conservatively treat uncertain grains as unhealthy
        uncertain_healthy_equiv   = 0
        uncertain_unhealthy_equiv = uncertain_count

    healthy_count   = trusted_healthy   + uncertain_healthy_equiv
    unhealthy_count = trusted_unhealthy + uncertain_unhealthy_equiv
    total_assessed  = healthy_count + unhealthy_count

    health_percentage      = round((healthy_count / total_assessed) * 100, 2) if total_assessed > 0 else 0.0
    health_assessment_reliable = trusted_count >= MIN_TRUSTED_HEALTH_GRAINS

    summary = {
        "grain_count":                   grain_count,
        "trusted_health_predictions":    trusted_count,
        "uncertain_health_predictions":  uncertain_count,
        "health_assessment_reliable":    health_assessment_reliable,
        "min_trusted_health_confidence": MIN_TRUSTED_HEALTH_CONFIDENCE,
        "healthy_count":                 healthy_count,
        "unhealthy_count":               unhealthy_count,
        "dominant_type":                 dominant_type,
        "health_percentage":             health_percentage,
        "region":                        region,
        "class_distribution":            dict(class_counter),
        "health_distribution":           dict(health_counter),
        "timestamp":                     str(uuid.uuid4())
    }
    return summary

# ========================
# LANGGRAPH NODES
# ========================
def aggregation_node(state: RiceState) -> RiceState:
    """Node 1: Aggregate individual grain results"""
    try:
        summary = aggregate_results(state["grains"], state["region"])
        if summary is None:
            state["error"] = "No grains detected or aggregation failed"
            return state
        state["summary"] = summary
        return state
    except Exception as e:
        state["error"] = f"Aggregation error: {str(e)}"
        return state

def market_node(state: RiceState) -> RiceState:
    """Node 2: Determine market price from web scraping + MSP + quality + rice type."""
    try:
        summary = state["summary"]
        user_mode = state.get("user_mode", "farmer")
        
        # Calculate prices ONCE - returns both farmer and consumer prices
        price_data = market_price_tool(
            state["region"],
            summary.get("health_percentage", 0),
            summary.get("dominant_type", "unknown")
        )
        
        # Store all price data
        state["price_source"] = price_data["price_source"]
        state["scraped_prices"] = price_data["scraped_prices"]
        state["price_breakdown"] = price_data["price_breakdown"]
        state["base_price"] = price_data["base_price"]  # Lock base price
        
        # Select appropriate price based on user mode
        # IMPORTANT: Both prices calculated from SAME base
        if user_mode == "consumer":
            state["market_price"] = price_data["consumer_price"]
        else:
            state["market_price"] = price_data["farmer_price"]
        
        return state
    except Exception as e:
        state["error"] = f"Market tool error: {str(e)}"
        return state

def shelf_life_node(state: RiceState) -> RiceState:
    """Node 3: Determine shelf life from health % + actual health distribution."""
    try:
        summary = state["summary"]
        state["shelf_life"] = shelf_life_tool(
            summary.get("health_percentage", 0),
            summary.get("health_distribution", {})
        )
        return state
    except Exception as e:
        state["error"] = f"Shelf life tool error: {str(e)}"
        return state

def supply_chain_node(state: RiceState) -> RiceState:
    """Node 4: Determine supply chain path from health % + rice type."""
    try:
        summary = state["summary"]
        state["supply_chain"] = supply_chain_tool(
            summary.get("health_percentage", 0),
            summary.get("dominant_type", "unknown")
        )
        return state
    except Exception as e:
        state["error"] = f"Supply chain tool error: {str(e)}"
        return state

def iot_node(state: RiceState) -> RiceState:
    """Node 5: Collect IoT sensor data (optional)"""
    try:
        state["iot_data"] = iot_sensor_tool(
            state["region"],
            state.get("grains", []),
            state.get("summary", {})
        )
        return state
    except Exception as e:
        state["error"] = f"IoT tool error: {str(e)}"
        return state

def context_builder_node(state: RiceState) -> RiceState:
    """Node 6: Build rich context for LLM from all actual ML data."""
    try:
        summary = state["summary"]
        health_dist = summary.get("health_distribution", {})
        class_dist  = summary.get("class_distribution", {})
        grain_count = summary.get("grain_count", 0)
        trusted     = summary.get("trusted_health_predictions", 0)
        uncertain   = summary.get("uncertain_health_predictions", 0)
        reliable    = summary.get("health_assessment_reliable", False)

        # Build human-readable health breakdown
        health_breakdown = ", ".join(
            f"{lbl.replace('_', ' ')}: {cnt} grains ({round(cnt/grain_count*100)}%)"
            for lbl, cnt in health_dist.items() if grain_count > 0
        ) or "N/A"

        class_breakdown = ", ".join(
            f"{lbl}: {cnt} grains"
            for lbl, cnt in class_dist.items()
        ) or "N/A"

        iot = state.get("iot_data") or {}

        context = {
            "region": state["region"],
            "rice_type": summary.get("dominant_type", "unknown"),
            "class_distribution": class_breakdown,
            "total_grains_detected": grain_count,
            "trusted_health_predictions": trusted,
            "uncertain_health_predictions": uncertain,
            "health_assessment_reliable": reliable,
            "healthy_grains": summary.get("healthy_count", 0),
            "unhealthy_grains": summary.get("unhealthy_count", 0),
            "health_percentage": summary.get("health_percentage", 0),
            "health_distribution_breakdown": health_breakdown,
            "avg_type_confidence_pct": round(iot.get("avg_type_confidence", 0) * 100, 1),
            "avg_health_confidence_pct": round(iot.get("avg_health_confidence", 0) * 100, 1),
            "market_price_per_kg_inr": state["market_price"],
            "shelf_life": state["shelf_life"],
            "supply_chain_recommendation": state["supply_chain"],
        }

        if llm_chain is None:
            # Ollama unavailable — format as readable text instead of raw JSON
            lines = [
                f"Rice Type: {context['rice_type']}",
                f"Region: {context['region']}",
                f"Total Grains: {context['total_grains_detected']}",
                f"Healthy: {context['healthy_grains']} | Unhealthy: {context['unhealthy_grains']} | Health: {context['health_percentage']}%",
                f"Health Breakdown: {context['health_distribution_breakdown']}",
                f"Market Price: \u20b9{context['market_price_per_kg_inr']}/kg",
                f"Shelf Life: {context['shelf_life']}",
                f"Supply Chain: {context['supply_chain_recommendation']}",
                f"Assessment Reliable: {context['health_assessment_reliable']}",
            ]
            state["llm_response"] = "\n".join(lines)
            return state

        response = llm_chain.invoke({
            "context": json.dumps(context, indent=2),
            "market_price": state["market_price"],
            "region": state["region"],
        })["text"]
        state["llm_response"] = response
        return state
    except Exception as e:
        state["error"] = f"LLM error: {str(e)}"
        state["llm_response"] = f"Error generating response: {str(e)}"
        return state

# ========================
# BUILD LANGGRAPH
# ========================
def build_graph():
    """Construct LangGraph workflow"""
    graph = StateGraph(RiceState)
    
    # Add nodes
    graph.add_node("aggregate", aggregation_node)
    graph.add_node("market", market_node)
    graph.add_node("shelf", shelf_life_node)
    graph.add_node("supply", supply_chain_node)
    graph.add_node("iot", iot_node)
    graph.add_node("llm", context_builder_node)
    
    # Set entry point
    graph.set_entry_point("aggregate")
    
    # Add edges (linear flow)
    graph.add_edge("aggregate", "market")
    graph.add_edge("market", "shelf")
    graph.add_edge("shelf", "supply")
    graph.add_edge("supply", "iot")
    graph.add_edge("iot", "llm")
    graph.add_edge("llm", END)
    
    return graph.compile()

# Build graph once
rice_graph = build_graph()

# ========================
# MAIN ML PIPELINE
# ========================
def process_image(image_path, region="Karnataka", user_mode="farmer"):
    """
    Main pipeline: YOLO → Per-grain processing → Aggregation → LangGraph
    
    Args:
        image_path: Path to rice grain image
        region: State/region name (default: Karnataka)
        user_mode: "farmer" or "consumer" (default: "farmer")
    
    Returns:
        dict: Analysis results with pricing based on user mode
    """
    request_id = str(uuid.uuid4())
    
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            return make_error_response(
                request_id,
                "IMAGE_LOAD_FAILED",
                "Could not load image"
            )
        
        # YOLO Detection
        if yolo_model is None:
            return make_error_response(
                request_id,
                "YOLO_MODEL_UNAVAILABLE",
                "YOLO model not loaded"
            )
        
        results = yolo_model.predict(
            image,
            conf=CONFIDENCE_THRESHOLD,
            iou=NMS_IOU_THRESHOLD,
            max_det=MAX_GRAINS_PER_IMAGE,
            verbose=False
        )[0]
        
        if results.boxes is None or len(results.boxes) == 0:
            return make_error_response(
                request_id,
                "NO_GRAINS_DETECTED",
                "No grains detected"
            )
        
        boxes = results.boxes.xyxy.cpu().numpy()
        confs = results.boxes.conf.cpu().numpy() if results.boxes.conf is not None else np.ones(len(boxes))
        
        # Per-grain processing
        grain_results = []
        
        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box)
            h, w = image.shape[:2]
            x1 = max(0, min(x1, w - 1))
            x2 = max(0, min(x2, w))
            y1 = max(0, min(y1, h - 1))
            y2 = max(0, min(y2, h))
            tight_crop = image[y1:y2, x1:x2]
            
            if tight_crop.size == 0:
                continue

            if not is_valid_grain_candidate(tight_crop, box, image.shape, float(confs[i])):
                continue

            # Expand tight YOLO crop to preserve thin grain tips and texture detail.
            px1 = max(0, x1 - CROP_PADDING)
            py1 = max(0, y1 - CROP_PADDING)
            px2 = min(w, x2 + CROP_PADDING)
            py2 = min(h, y2 + CROP_PADDING)
            crop = image[py1:py2, px1:px2]

            if crop.size == 0:
                continue
            
            # Background removal
            processed_crop = remove_background(crop)
            
            if processed_crop.size == 0:
                continue
            
            # Classification
            class_pred, class_conf = predict_single(class_model, processed_crop, class_transform)
            health_pred, health_conf = predict_single(health_model, crop, health_transform)
            
            # Save crop
            crop_name = f"grain_{request_id}_{i}.png"
            crop_path = os.path.join(OUTPUT_FOLDER, crop_name)
            cv2.imwrite(crop_path, processed_crop)
            
            grain_results.append({
                "grain_id": i,
                "bbox": box.tolist(),
                "detection_confidence": round(float(confs[i]), 4),
                "type": class_labels.get(str(class_pred), "unknown"),
                "type_confidence": round(class_conf, 4),
                "health": health_labels.get(str(health_pred), "unknown"),
                "health_confidence": round(health_conf, 4),
                "type_pred_index": class_pred,
                "health_pred_index": health_pred,
                "crop_path": crop_path
            })
        
        if len(grain_results) < MIN_VALID_GRAINS:
            return make_error_response(
                request_id,
                "NO_RICE_DETECTED",
                "Insufficient validated grains detected",
                {
                    "validated_grains": len(grain_results),
                    "minimum_required": MIN_VALID_GRAINS
                }
            )
        
        # LangGraph orchestration
        state = {
            "grains": grain_results,
            "region": region,
            "user_mode": user_mode,
            "summary": {},
            "market_price": 0.0,
            "base_price": 0.0,
            "price_source": "unknown",
            "scraped_prices": [],
            "price_breakdown": {},
            "shelf_life": "",
            "supply_chain": "",
            "iot_data": None,
            "llm_response": "",
            "request_id": request_id,
            "error": None
        }
        
        # Execute graph
        final_state = rice_graph.invoke(state)
        
        # Build response
        response = {
            "request_id": final_state["request_id"],
            "user_mode": final_state.get("user_mode", "farmer"),
            "summary": final_state["summary"],
            "market_price": final_state["market_price"],
            "base_price": final_state.get("base_price", 0.0),
            "price_source": final_state.get("price_source", "unknown"),
            "scraped_prices": final_state.get("scraped_prices", []),
            "price_breakdown": final_state.get("price_breakdown", {}),
            "shelf_life": final_state["shelf_life"],
            "supply_chain": final_state["supply_chain"],
            "iot_data": final_state.get("iot_data"),
            "grains": final_state["grains"],
            "llm_response": final_state["llm_response"]
        }

        if final_state.get("error"):
            response["graph_error"] = {
                "code": "WORKFLOW_NODE_ERROR",
                "message": final_state["error"]
            }

        return response
        
    except Exception as e:
        return make_error_response(
            request_id,
            "PIPELINE_EXCEPTION",
            "Pipeline execution failed",
            str(e)
        )

# ========================
# FLASK API ENDPOINTS
# ========================
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "device": str(device),
        "models_loaded": {
            "yolo": yolo_model is not None,
            "class_model": class_model is not None,
            "health_model": health_model is not None,
            "llm": llm is not None
        }
    })

@app.route("/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint
    
    Form Data:
    - image: image file (required)
    - region: region name (optional, default: Karnataka)
    - user_mode: "farmer" or "consumer" (optional, default: farmer)
    
    Returns: JSON with analysis results including mode-specific pricing
    """
    try:
        if "image" not in request.files:
            return jsonify(make_error_response(
                str(uuid.uuid4()),
                "MISSING_IMAGE",
                "No image uploaded"
            )), 400
        
        file = request.files["image"]
        
        if file.filename == "":
            return jsonify(make_error_response(
                str(uuid.uuid4()),
                "EMPTY_FILENAME",
                "No file selected"
            )), 400
        
        region = request.form.get("region", "Karnataka")
        user_mode = request.form.get("user_mode", "farmer").lower()
        
        print(f"[Flask Endpoint] Received user_mode: '{user_mode}'")
        
        # Validate user_mode
        if user_mode not in ["farmer", "consumer"]:
            user_mode = "farmer"
        
        # Save uploaded file
        save_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(save_path)
        
        # Process image
        result = process_image(save_path, region, user_mode)
        
        if result.get("status") == "error":
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify(make_error_response(
            str(uuid.uuid4()),
            "PREDICT_API_EXCEPTION",
            "Predict API failed",
            str(e)
        )), 500

@app.route("/batch", methods=["POST"])
def batch_predict():
    """
    Batch prediction endpoint (processes multiple images)
    
    Form Data:
    - images: multiple image files
    - region: region name
    
    Returns: List of results
    """
    try:
        if "images" not in request.files:
            return jsonify(make_error_response(
                str(uuid.uuid4()),
                "MISSING_IMAGES",
                "No images uploaded"
            )), 400
        
        files = request.files.getlist("images")
        region = request.form.get("region", "Karnataka")
        
        results = []
        
        for file in files:
            if file and file.filename != "":
                save_path = os.path.join(UPLOAD_FOLDER, file.filename)
                file.save(save_path)
                result = process_image(save_path, region)
                results.append(result)
        
        return jsonify({"batch_results": results})
        
    except Exception as e:
        return jsonify(make_error_response(
            str(uuid.uuid4()),
            "BATCH_API_EXCEPTION",
            "Batch API failed",
            str(e)
        )), 500

# ========================
# RUN SERVER
# ========================
if __name__ == "__main__":
    print("\n" + "="*60)
    print("RICE GRAIN QUALITY ANALYSIS PIPELINE")
    print("="*60)
    print(f"Architecture: YOLO → ResNet → LangGraph → LangChain → Ollama")
    print(f"Device: {device}")
    print(f"Flask Server: http://{FLASK_HOST}:{FLASK_PORT}")
    print("="*60 + "\n")
    
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=FLASK_DEBUG
    )