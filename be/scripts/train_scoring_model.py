import os
import joblib
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression

def generate_dummy_data(n_samples=500):
    np.random.seed(42)
    
    # 1. approval_ratio: 0.0 to 1.0 (mean around 0.8)
    approval_ratio = np.random.beta(8, 2, n_samples)
    
    # 2. submission_count: 1 to 50
    submission_count = np.random.randint(1, 51, n_samples)
    
    # 3. active_days: 1 to 30
    active_days = np.random.randint(1, 31, n_samples)
    
    # 4. avg_nominal: 50k to 5M
    avg_nominal = np.random.uniform(50000, 5000000, n_samples)
    
    # 5. consistency_score: 0.0 to 1.0
    consistency_score = np.random.beta(5, 5, n_samples)
    
    # Create target: is_eligible (1 or 0)
    score = (
        (approval_ratio * 3) + 
        (active_days / 30 * 2) + 
        (consistency_score * 2) +
        (submission_count / 50 * 1) - 
        (avg_nominal / 5000000 * 1)
    )
    
    threshold = np.percentile(score, 40)
    is_eligible = (score >= threshold).astype(int)
    
    df = pd.DataFrame({
        'approval_ratio': approval_ratio,
        'submission_count': submission_count,
        'active_days': active_days,
        'avg_nominal': avg_nominal,
        'consistency_score': consistency_score,
        'is_eligible': is_eligible
    })
    
    return df

def train_and_save_model():
    print("Generating dummy data...")
    df = generate_dummy_data(1000)
    
    X = df[['approval_ratio', 'submission_count', 'active_days', 'avg_nominal', 'consistency_score']]
    y = df['is_eligible']
    
    print("Training Logistic Regression model...")
    X_scaled = X.copy()
    X_scaled['avg_nominal'] = X_scaled['avg_nominal'] / 1000000.0
    
    model = LogisticRegression(random_state=42, class_weight='balanced')
    model.fit(X_scaled, y)
    
    print("Model coefficients:")
    for feature, coef in zip(X.columns, model.coef_[0]):
        print(f"  {feature}: {coef:.4f}")
        
    print(f"Intercept: {model.intercept_[0]:.4f}")
    print(f"Accuracy: {model.score(X_scaled, y):.4f}")
    
    os.makedirs('be/models', exist_ok=True)
    model_path = 'be/models/scoring_model.pkl'
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_and_save_model()
