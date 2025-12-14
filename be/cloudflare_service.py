"""
Cloudflare CDN Service
File: be/cloudflare_service.py
Handles file uploads to Cloudflare R2 Storage and CDN management
"""

import os
import requests
import json
from typing import Optional, Dict, Any
from datetime import datetime
import hashlib
import mimetypes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class CloudflareService:
    def __init__(self):
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.zone_id = os.getenv("CLOUDFLARE_ZONE_ID")
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        
        if not all([self.api_token, self.zone_id, self.account_id]):
            print("⚠️ Cloudflare credentials not configured - service disabled")
            self.enabled = False
        else:
            print("✅ Cloudflare service initialized and enabled")
            self.enabled = True
        
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        self.base_url = "https://api.cloudflare.com/client/v4"
    
    async def upload_to_r2(self, file_content: bytes, file_name: str, bucket_name: str = "logistic-files") -> Dict[str, Any]:
        """Upload file to Cloudflare R2 Storage"""
        try:
            # Generate unique filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_hash = hashlib.md5(file_content).hexdigest()[:8]
            unique_filename = f"{timestamp}_{file_hash}_{file_name}"
            
            # Get MIME type
            content_type = mimetypes.guess_type(file_name)[0] or 'application/octet-stream'
            
            # R2 Upload URL
            upload_url = f"{self.base_url}/accounts/{self.account_id}/r2/buckets/{bucket_name}/objects/{unique_filename}"
            
            upload_headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": content_type
            }
            
            # Upload to R2
            response = requests.put(upload_url, data=file_content, headers=upload_headers)
            
            if response.status_code in [200, 201]:
                # Generate CDN URL
                cdn_url = f"https://files.ocr.wtf/{unique_filename}"
                
                return {
                    "status": "success",
                    "file_url": cdn_url,
                    "file_name": unique_filename,
                    "file_size": len(file_content),
                    "content_type": content_type,
                    "bucket": bucket_name
                }
            else:
                return {
                    "status": "error",
                    "message": f"Upload failed: {response.text}"
                }
                
        except Exception as e:
            return {
                "status": "error", 
                "message": f"Upload error: {str(e)}"
            }
    
    async def delete_from_r2(self, file_name: str, bucket_name: str = "logistic-files") -> Dict[str, Any]:
        """Delete file from Cloudflare R2"""
        try:
            delete_url = f"{self.base_url}/accounts/{self.account_id}/r2/buckets/{bucket_name}/objects/{file_name}"
            
            response = requests.delete(delete_url, headers=self.headers)
            
            if response.status_code == 204:
                return {"status": "success", "message": "File deleted successfully"}
            else:
                return {"status": "error", "message": f"Delete failed: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Delete error: {str(e)}"}
    
    async def purge_cache(self, urls: list) -> Dict[str, Any]:
        """Purge Cloudflare cache for specific URLs"""
        try:
            purge_url = f"{self.base_url}/zones/{self.zone_id}/purge_cache"
            
            payload = {"files": urls}
            
            response = requests.post(purge_url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                return {"status": "success", "message": "Cache purged successfully"}
            else:
                return {"status": "error", "message": f"Purge failed: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Purge error: {str(e)}"}
    
    async def get_analytics(self) -> Dict[str, Any]:
        """Get Cloudflare analytics data"""
        try:
            analytics_url = f"{self.base_url}/zones/{self.zone_id}/analytics/dashboard"
            
            response = requests.get(analytics_url, headers=self.headers)
            
            if response.status_code == 200:
                return {"status": "success", "data": response.json()}
            else:
                return {"status": "error", "message": f"Analytics failed: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Analytics error: {str(e)}"}
    
    async def create_page_rule(self, pattern: str, actions: Dict) -> Dict[str, Any]:
        """Create Cloudflare page rule"""
        try:
            page_rules_url = f"{self.base_url}/zones/{self.zone_id}/pagerules"
            
            payload = {
                "targets": [{"target": "url", "constraint": {"operator": "matches", "value": pattern}}],
                "actions": [{"id": k, "value": v} for k, v in actions.items()],
                "status": "active"
            }
            
            response = requests.post(page_rules_url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                return {"status": "success", "data": response.json()}
            else:
                return {"status": "error", "message": f"Page rule creation failed: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Page rule error: {str(e)}"}

    def get_nameservers(self) -> Dict[str, Any]:
        """Get Cloudflare nameservers for domain"""
        try:
            zone_url = f"{self.base_url}/zones/{self.zone_id}"
            response = requests.get(zone_url, headers=self.headers)
            
            if response.status_code == 200:
                zone_data = response.json()["result"]
                return {
                    "status": "success",
                    "nameservers": zone_data.get("name_servers", []),
                    "zone_status": zone_data.get("status"),
                    "domain": zone_data.get("name")
                }
            else:
                return {"status": "error", "message": f"Failed to get nameservers: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"Nameserver error: {str(e)}"}
    
    def check_dns_status(self) -> Dict[str, Any]:
        """Check DNS status and provide fix instructions"""
        try:
            nameserver_info = self.get_nameservers()
            
            if nameserver_info["status"] == "success":
                return {
                    "status": "success",
                    "domain": nameserver_info["domain"],
                    "zone_status": nameserver_info["zone_status"],
                    "cloudflare_nameservers": nameserver_info["nameservers"],
                    "instructions": {
                        "message": "Set these nameservers at your domain registrar:",
                        "steps": [
                            "1. Login to your domain registrar (e.g., Namecheap, GoDaddy)",
                            "2. Go to domain management/DNS settings",
                            "3. Replace current nameservers with Cloudflare nameservers",
                            "4. Wait 24-48 hours for propagation"
                        ]
                    }
                }
            else:
                return nameserver_info
                
        except Exception as e:
            return {"status": "error", "message": f"DNS check error: {str(e)}"}

    def create_dns_record(self, record_type: str, name: str, content: str, ttl: int = 1) -> Dict[str, Any]:
        """Create DNS record (A, CNAME, etc.)"""
        try:
            dns_url = f"{self.base_url}/zones/{self.zone_id}/dns_records"
            
            payload = {
                "type": record_type,
                "name": name,
                "content": content,
                "ttl": ttl,
                "proxied": True if record_type in ["A", "CNAME"] else False
            }
            
            response = requests.post(dns_url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()["result"]
                return {
                    "status": "success",
                    "message": f"DNS record created: {name} → {content}",
                    "data": result
                }
            else:
                return {"status": "error", "message": f"DNS creation failed: {response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"DNS creation error: {str(e)}"}

    def setup_required_dns(self, vps_ip: str = "43.157.227.192") -> Dict[str, Any]:
        """Setup all required DNS records for the application"""
        try:
            results = []
            
            # 1. Frontend domain (ocr.wtf → Vercel/Render frontend)
            result1 = self.create_dns_record("CNAME", "@", "cname.vercel-dns.com")
            results.append({"record": "@ (frontend - ocr.wtf)", "result": result1})
            
            # 2. API backend domain - need separate zone for api-ocr.xyz
            # This will be handled separately in api-ocr.xyz zone
            
            # 3. Files subdomain for R2 storage (files.ocr.wtf → Cloudflare R2)
            result3 = self.create_dns_record("CNAME", "files", f"{self.account_id}.r2.dev")
            results.append({"record": "files.ocr.wtf (R2 storage)", "result": result3})
            
            # 4. WWW redirect (www.ocr.wtf → ocr.wtf)
            result4 = self.create_dns_record("CNAME", "www", "ocr.wtf")
            results.append({"record": "www.ocr.wtf redirect", "result": result4})
            
            success_count = sum(1 for r in results if r["result"]["status"] == "success")
            
            return {
                "status": "success" if success_count > 0 else "error",
                "message": f"DNS setup completed for ocr.wtf: {success_count}/3 records created",
                "records": results,
                "note": "Backend API domain (api-ocr.xyz) needs separate Cloudflare zone setup"
            }
            
        except Exception as e:
            return {"status": "error", "message": f"DNS setup error: {str(e)}"}
    
    def setup_api_domain_dns(self, api_zone_id: str, vps_ip: str = "43.157.227.192") -> Dict[str, Any]:
        """Setup DNS for api-ocr.xyz domain (separate zone)"""
        try:
            # Temporarily switch to API domain zone
            original_zone = self.zone_id
            self.zone_id = api_zone_id
            
            results = []
            
            # 1. Main API domain (api-ocr.xyz → VPS)
            result1 = self.create_dns_record("A", "@", vps_ip)
            results.append({"record": "@ (api-ocr.xyz)", "result": result1})
            
            # 2. WWW redirect for API domain
            result2 = self.create_dns_record("CNAME", "www", "api-ocr.xyz")
            results.append({"record": "www.api-ocr.xyz", "result": result2})
            
            # Restore original zone
            self.zone_id = original_zone
            
            success_count = sum(1 for r in results if r["result"]["status"] == "success")
            
            return {
                "status": "success" if success_count > 0 else "error",
                "message": f"API domain DNS setup: {success_count}/2 records created",
                "records": results
            }
            
        except Exception as e:
            # Restore original zone on error
            self.zone_id = original_zone if 'original_zone' in locals() else self.zone_id
            return {"status": "error", "message": f"API DNS setup error: {str(e)}"}

    def setup_ssl_settings(self) -> Dict[str, Any]:
        """Configure SSL/TLS settings for domain"""
        try:
            results = []
            
            # 1. Set SSL mode to Full (strict)
            ssl_url = f"{self.base_url}/zones/{self.zone_id}/settings/ssl"
            ssl_payload = {"value": "full"}
            ssl_response = requests.patch(ssl_url, headers=self.headers, json=ssl_payload)
            results.append({
                "setting": "SSL Mode",
                "status": "success" if ssl_response.status_code == 200 else "error",
                "value": "Full (strict)"
            })
            
            # 2. Enable Always Use HTTPS
            https_url = f"{self.base_url}/zones/{self.zone_id}/settings/always_use_https"
            https_payload = {"value": "on"}
            https_response = requests.patch(https_url, headers=self.headers, json=https_payload)
            results.append({
                "setting": "Always Use HTTPS",
                "status": "success" if https_response.status_code == 200 else "error",
                "value": "Enabled"
            })
            
            # 3. Enable HSTS
            hsts_url = f"{self.base_url}/zones/{self.zone_id}/settings/security_header"
            hsts_payload = {
                "value": {
                    "strict_transport_security": {
                        "enabled": True,
                        "max_age": 31536000,
                        "include_subdomains": True,
                        "preload": True
                    }
                }
            }
            hsts_response = requests.patch(hsts_url, headers=self.headers, json=hsts_payload)
            results.append({
                "setting": "HSTS",
                "status": "success" if hsts_response.status_code == 200 else "error",
                "value": "Enabled with subdomains"
            })
            
            # 4. Enable Automatic HTTPS Rewrites
            auto_https_url = f"{self.base_url}/zones/{self.zone_id}/settings/automatic_https_rewrites"
            auto_https_payload = {"value": "on"}
            auto_https_response = requests.patch(auto_https_url, headers=self.headers, json=auto_https_payload)
            results.append({
                "setting": "Auto HTTPS Rewrites",
                "status": "success" if auto_https_response.status_code == 200 else "error",
                "value": "Enabled"
            })
            
            success_count = sum(1 for r in results if r["status"] == "success")
            
            return {
                "status": "success" if success_count > 0 else "error",
                "message": f"SSL setup completed: {success_count}/4 settings configured",
                "settings": results
            }
            
        except Exception as e:
            return {"status": "error", "message": f"SSL setup error: {str(e)}"}

    def setup_page_rules(self) -> Dict[str, Any]:
        """Setup page rules for optimal performance and security"""
        try:
            results = []
            page_rules_url = f"{self.base_url}/zones/{self.zone_id}/pagerules"
            
            # 1. Cache everything for static assets
            rule1 = {
                "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "*.ocr.wtf/*.css"}}],
                "actions": [
                    {"id": "cache_level", "value": "cache_everything"},
                    {"id": "edge_cache_ttl", "value": 2592000}  # 30 days
                ],
                "status": "active"
            }
            response1 = requests.post(page_rules_url, headers=self.headers, json=rule1)
            results.append({"rule": "CSS Caching", "status": "success" if response1.status_code == 200 else "error"})
            
            # 2. Cache JS files
            rule2 = {
                "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "*.ocr.wtf/*.js"}}],
                "actions": [
                    {"id": "cache_level", "value": "cache_everything"},
                    {"id": "edge_cache_ttl", "value": 2592000}
                ],
                "status": "active"
            }
            response2 = requests.post(page_rules_url, headers=self.headers, json=rule2)
            results.append({"rule": "JS Caching", "status": "success" if response2.status_code == 200 else "error"})
            
            # 3. Cache images and assets
            rule3 = {
                "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "files.ocr.wtf/*"}}],
                "actions": [
                    {"id": "cache_level", "value": "cache_everything"},
                    {"id": "edge_cache_ttl", "value": 604800},  # 7 days
                    {"id": "browser_cache_ttl", "value": 604800}
                ],
                "status": "active"
            }
            response3 = requests.post(page_rules_url, headers=self.headers, json=rule3)
            results.append({"rule": "Files CDN Caching", "status": "success" if response3.status_code == 200 else "error"})
            
            # 4. Bypass cache for API endpoints
            rule4 = {
                "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "api-ocr.xyz/api/*"}}],
                "actions": [
                    {"id": "cache_level", "value": "bypass"}
                ],
                "status": "active"
            }
            response4 = requests.post(page_rules_url, headers=self.headers, json=rule4)
            results.append({"rule": "API Cache Bypass", "status": "success" if response4.status_code == 200 else "error"})
            
            success_count = sum(1 for r in results if r["status"] == "success")
            
            return {
                "status": "success" if success_count > 0 else "error",
                "message": f"Page rules setup: {success_count}/4 rules created",
                "rules": results
            }
            
        except Exception as e:
            return {"status": "error", "message": f"Page rules error: {str(e)}"}

    def setup_caching_settings(self) -> Dict[str, Any]:
        """Configure caching settings for optimal performance"""
        try:
            results = []
            
            # 1. Set caching level to Standard
            cache_level_url = f"{self.base_url}/zones/{self.zone_id}/settings/cache_level"
            cache_payload = {"value": "aggressive"}
            cache_response = requests.patch(cache_level_url, headers=self.headers, json=cache_payload)
            results.append({
                "setting": "Cache Level",
                "status": "success" if cache_response.status_code == 200 else "error",
                "value": "Aggressive"
            })
            
            # 2. Enable Browser Cache TTL
            browser_cache_url = f"{self.base_url}/zones/{self.zone_id}/settings/browser_cache_ttl"
            browser_cache_payload = {"value": 604800}  # 7 days
            browser_response = requests.patch(browser_cache_url, headers=self.headers, json=browser_cache_payload)
            results.append({
                "setting": "Browser Cache TTL",
                "status": "success" if browser_response.status_code == 200 else "error",
                "value": "7 days"
            })
            
            # 3. Enable Development Mode Off (production)
            dev_mode_url = f"{self.base_url}/zones/{self.zone_id}/settings/development_mode"
            dev_mode_payload = {"value": "off"}
            dev_response = requests.patch(dev_mode_url, headers=self.headers, json=dev_mode_payload)
            results.append({
                "setting": "Development Mode",
                "status": "success" if dev_response.status_code == 200 else "error",
                "value": "Off (Production)"
            })
            
            success_count = sum(1 for r in results if r["status"] == "success")
            
            return {
                "status": "success" if success_count > 0 else "error",
                "message": f"Caching settings: {success_count}/3 configured",
                "settings": results
            }
            
        except Exception as e:
            return {"status": "error", "message": f"Caching setup error: {str(e)}"}

    def setup_r2_bucket(self, bucket_name: str = "logistic-files") -> Dict[str, Any]:
        """Create and configure R2 storage bucket"""
        try:
            results = []
            
            # 1. Create R2 bucket
            bucket_url = f"{self.base_url}/accounts/{self.account_id}/r2/buckets"
            bucket_payload = {
                "name": bucket_name,
                "location": "auto"
            }
            bucket_response = requests.post(bucket_url, headers=self.headers, json=bucket_payload)
            
            if bucket_response.status_code in [200, 409]:  # 409 = already exists
                results.append({"action": "Create Bucket", "status": "success", "message": f"Bucket '{bucket_name}' ready"})
                
                # 2. Configure CORS for web access
                cors_url = f"{self.base_url}/accounts/{self.account_id}/r2/buckets/{bucket_name}/cors"
                cors_payload = {
                    "cors_rules": [
                        {
                            "allowed_origins": ["https://ocr.wtf", "https://www.ocr.wtf"],
                            "allowed_methods": ["GET", "PUT", "POST", "DELETE"],
                            "allowed_headers": ["*"],
                            "expose_headers": ["ETag"],
                            "max_age": 3600
                        }
                    ]
                }
                cors_response = requests.put(cors_url, headers=self.headers, json=cors_payload)
                results.append({
                    "action": "Configure CORS", 
                    "status": "success" if cors_response.status_code == 200 else "error"
                })
                
                # 3. Set public access policy
                policy_url = f"{self.base_url}/accounts/{self.account_id}/r2/buckets/{bucket_name}/policy"
                policy_payload = {
                    "policy": {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Sid": "PublicReadGetObject",
                                "Effect": "Allow",
                                "Principal": "*",
                                "Action": "s3:GetObject",
                                "Resource": f"arn:aws:s3:::{bucket_name}/*"
                            }
                        ]
                    }
                }
                policy_response = requests.put(policy_url, headers=self.headers, json=policy_payload)
                results.append({
                    "action": "Set Public Access", 
                    "status": "success" if policy_response.status_code == 200 else "error"
                })
                
            else:
                results.append({"action": "Create Bucket", "status": "error", "message": bucket_response.text})
            
            success_count = sum(1 for r in results if r["status"] == "success")
            
            return {
                "status": "success" if success_count > 0 else "error",
                "message": f"R2 bucket setup: {success_count}/{len(results)} actions completed",
                "bucket_name": bucket_name,
                "cdn_url": f"https://files.ocr.wtf",
                "actions": results
            }
            
        except Exception as e:
            return {"status": "error", "message": f"R2 setup error: {str(e)}"}

    def get_r2_usage(self, bucket_name: str = "logistic-files") -> Dict[str, Any]:
        """Get R2 storage usage statistics"""
        try:
            # Get bucket info
            bucket_url = f"{self.base_url}/accounts/{self.account_id}/r2/buckets/{bucket_name}"
            bucket_response = requests.get(bucket_url, headers=self.headers)
            
            if bucket_response.status_code == 200:
                bucket_data = bucket_response.json()["result"]
                
                # Get usage stats (simplified)
                return {
                    "status": "success",
                    "bucket": bucket_name,
                    "created": bucket_data.get("creation_date"),
                    "location": bucket_data.get("location"),
                    "cdn_url": f"https://files.ocr.wtf"
                }
            else:
                return {"status": "error", "message": f"Bucket not found: {bucket_response.text}"}
                
        except Exception as e:
            return {"status": "error", "message": f"R2 usage error: {str(e)}"}

# Initialize Cloudflare service instance
try:
    cloudflare_service = CloudflareService()
    print("✅ Cloudflare service initialized successfully")
except Exception as e:
    print(f"⚠️ Cloudflare service initialization failed: {e}")
    cloudflare_service = None