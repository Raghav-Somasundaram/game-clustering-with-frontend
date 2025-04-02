from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import torch
import clip
from PIL import Image
import cv2
import numpy as np
import shutil
import os
import pickle
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import seaborn as sns
import uuid
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# Allow CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load CLIP Model
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

# Clustering Data
clusters = {}
cluster_labels = []
cluster_features = []

# Confidence threshold for new game detection (Increased from 0.2 to 0.7)
CONFIDENCE_THRESHOLD = 0.7

# Load existing clusters if available
def load_clusters():
    global clusters, cluster_labels, cluster_features
    if os.path.exists("clusters.pkl"):
        with open("clusters.pkl", "rb") as f:
            clusters, cluster_labels, cluster_features = pickle.load(f)

load_clusters()

# Save clusters
def save_clusters():
    with open("clusters.pkl", "wb") as f:
        pickle.dump((clusters, cluster_labels, cluster_features), f)

# Extract features from an image
def extract_features(image: Image.Image):
    image = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        features = model.encode_image(image)
    return features.cpu().numpy().astype(np.float32).flatten()

# Extract frames at 1 FPS from video
def extract_frames(video_path):
    cap = cv2.VideoCapture(video_path)
    fps = int(cap.get(cv2.CAP_PROP_FPS))  
    frames = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % fps == 0:  
            frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
        frame_count += 1

    cap.release()
    return frames

# Function to visualize clusters using PCA
def visualize_clusters():
    if not clusters:
        return None

    all_data = []
    all_labels = []
    
    for game, features in clusters.items():
        all_data.extend(features)
        all_labels.extend([game] * len(features))

    all_data = np.array(all_data)

    if len(all_data) < 2:
        return None  # Not enough data for visualization

    pca = PCA(n_components=2)
    reduced_data = pca.fit_transform(all_data)

    unique_labels = list(set(all_labels))
    palette = sns.color_palette("husl", len(unique_labels))

    plt.figure(figsize=(10, 7))
    for i, label in enumerate(unique_labels):
        idx = [j for j in range(len(all_labels)) if all_labels[j] == label]
        plt.scatter(reduced_data[idx, 0], reduced_data[idx, 1], label=label, color=palette[i], alpha=0.7)

    plt.legend()
    plt.xlabel("PCA Feature 1")
    plt.ylabel("PCA Feature 2")
    plt.title("Gameplay Clustering Visualization")

    img_path = f"static/cluster_visualization_{uuid.uuid4().hex}.png"
    os.makedirs("static", exist_ok=True)
    plt.savefig(img_path)
    plt.close()

    return img_path

# API route to get statistics
@app.get("/stats")
async def get_stats():
    stats = {game: len(frames) for game, frames in clusters.items()}
    return JSONResponse(content=stats)

# API route to get cluster visualization
@app.get("/visualize_clusters")
async def get_cluster_visualization():
    img_path = visualize_clusters()
    if img_path:
        return JSONResponse(content={"image_url": img_path})
    return JSONResponse(content={"error": "No clusters available"}, status_code=404)

# Upload video API
@app.post("/upload/")
async def upload_video(video: UploadFile = File(...), is_labeled: bool = Form(...), game_name: str = Form(None)):
    temp_video_path = f"temp/{video.filename}"
    os.makedirs("temp", exist_ok=True)
    with open(temp_video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)

    frames = extract_frames(temp_video_path)

    # Delete the temp video after processing
    if os.path.exists(temp_video_path):
        os.remove(temp_video_path)

    if not frames:
        return JSONResponse(content={"error": "Could not process video"}, status_code=400)

    all_features = [extract_features(frame) for frame in frames]

    if is_labeled and game_name:
        clusters[game_name] = clusters.get(game_name, []) + all_features
        cluster_labels.extend([game_name] * len(all_features))
        cluster_features.extend(all_features)

        save_clusters()
        visualize_clusters()
        return {"message": f"New game '{game_name}' added to clusters."}

    elif not is_labeled:
        if not cluster_features:
            return {"message": "No existing clusters to compare with"}

        # Compute the centroid of each cluster
        cluster_centroids = {
            game: np.mean(features, axis=0) for game, features in clusters.items()
        }

        # Compute similarity of the new video with each cluster centroid
        video_feature_matrix = np.array(all_features)
        video_avg_feature = np.mean(video_feature_matrix, axis=0).reshape(1, -1)

        best_match = None
        best_similarity = 0

        for game, centroid in cluster_centroids.items():
            centroid = centroid.reshape(1, -1)
            similarity = cosine_similarity(video_avg_feature, centroid)[0][0]
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = game

        if best_similarity < CONFIDENCE_THRESHOLD:  
            new_game_name = "No match of games found"
            clusters[new_game_name] = all_features
            cluster_labels.extend([new_game_name] * len(all_features))
            cluster_features.extend(all_features)
            save_clusters()

            visualize_clusters()  
            return {"game": new_game_name}

        else:
            clusters[best_match].extend(all_features)
            cluster_labels.extend([best_match] * len(all_features))
            cluster_features.extend(all_features)
            save_clusters()

            visualize_clusters()  
            return {"game": best_match}

    else:
        return JSONResponse(content={"error": "Invalid input. Provide a game name for labeled videos."}, status_code=400)