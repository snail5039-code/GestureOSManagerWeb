package com.example.demo.info;

import java.util.Map;

import com.example.demo.social.OAuth2UserInfo;

@SuppressWarnings("rawtypes")
public class KakaoUserInfo implements OAuth2UserInfo {
    private final Map<String, Object> attributes;

    public KakaoUserInfo(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    @Override public String getProvider() { return "kakao"; }

    @Override
    public String getProviderKey() {
        Object id = attributes.get("id");
        return id == null ? null : id.toString();
    }

    @Override
    public String getEmail() {
        // 카카오는 설정에 따라 email이 없을 수 있음
        Object kakaoAccount = attributes.get("kakao_account");
        if (kakaoAccount instanceof Map map) {
            Object email = map.get("email");
            return email == null ? null : email.toString();
        }
        return null;
    }

    @Override
    public String getName() {
        Object props = attributes.get("properties");
        if (props instanceof Map map) {
            Object name = map.get("name");
            return name == null ? null : name.toString();
        }
        return null;
    }
}


