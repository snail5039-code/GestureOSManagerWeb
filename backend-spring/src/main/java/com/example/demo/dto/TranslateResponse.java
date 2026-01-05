package com.example.demo.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TranslateResponse {

  @JsonProperty("label")
  @JsonAlias({"word_id", "wordId", "id"})
  private String label;

  private String text;
  private double confidence;

  @JsonProperty("frames_received")
  @JsonAlias({"framesReceived"})
  private Integer framesReceived;

  private String mode;
  private Integer streak;

  // ✅ 추가: python /predict 에서 내려주는 topk 후보
  // 형태: [["WORD00012", 0.31], ["WORD00005", 0.21], ...]
  private List<List<Object>> candidates;

  private KcisaItem kcisa;
}
