"""
RunPod Serverless Handler — 기어 시스템
요청이 들어오면 자동으로 GPU 켜짐 → 생성 → 자동 꺼짐
"""
import runpod
import json
import os

def handler(event):
    """메인 핸들러"""
    try:
        input_data = event.get("input", {})
        action = input_data.get("action", "generate")
        gear_level = input_data.get("gear", 1)
        prompt = input_data.get("prompt", "")
        reference_image = input_data.get("reference_image", None)
        preset = input_data.get("preset", None)
        pose = input_data.get("pose", None)

        # 프리셋 적용
        PRESETS = {
            "news_anchor": {"gear": 4, "prompt": "Korean male news anchor, navy suit, red tie, dark studio, red signal light, confident, 4K", "pose": "anchor_front"},
            "signal_alert": {"gear": 4, "prompt": "Korean businessman pressing red emergency button, dramatic red lighting, dark background, serious, 4K", "pose": "button_press"},
            "profile_power": {"gear": 4, "prompt": "Korean CEO arms crossed, black suit red pocket square, dark gradient, red signal waves, 4K", "pose": "arms_crossed"},
            "casual_friendly": {"gear": 3, "prompt": "Korean businessman smart casual, navy cardigan, warm smile, modern office, 4K"},
            "godfather": {"gear": 1, "prompt": "Korean businessman luxurious black suit, Godfather dramatic lighting, dark moody, red accent, 4K"},
        }

        if preset and preset in PRESETS:
            config = PRESETS[preset]
            gear_level = config.get("gear", gear_level)
            prompt = config.get("prompt", prompt)
            pose = config.get("pose", pose)

        # 기어별 파라미터
        GEAR_PARAMS = {
            1: {"pulid_weight": 0.92, "cfg": 4.5},
            3: {"ip_adapter_weight": 0.6, "pulid_weight": 0.82, "cfg": 5.0},
            4: {"controlnet_weight": 0.85, "ip_adapter_weight": 0.6, "pulid_weight": 0.82, "end_at": 0.70, "cfg": 5.0},
        }

        params = GEAR_PARAMS.get(gear_level, GEAR_PARAMS[1])

        # TODO: ComfyUI 워크플로우 실행
        # 현재는 파라미터만 반환 (ComfyUI 연동 후 실제 생성)
        return {
            "status": "success",
            "gear": gear_level,
            "preset": preset,
            "prompt": prompt,
            "params": params,
            "pose": pose,
            "message": "ComfyUI 연동 후 실제 이미지 생성 예정",
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


runpod.serverless.start({"handler": handler})
