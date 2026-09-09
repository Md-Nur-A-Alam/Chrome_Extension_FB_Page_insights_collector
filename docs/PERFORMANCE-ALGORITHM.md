# Performance Algorithm Specification: Facebook Page Analytics Extension

## 1. Overview & Objectives
A core feature of the analytics engine is evaluating whether a Facebook Post or Reel is performing well, average, or poorly relative to the Page's standard historical output.

Crucially:
* **Content Age Matters**: A post that achieved 500 likes in 2 hours is outperforming a post that achieved 500 likes over 30 days. We use **Age-Normalized Velocity**.
* **Baselines Are Content-Type Specific**: Reels are compared against Reels; Posts are compared against Posts.
* **Exclusion of Self**: An item is never evaluated against a baseline that includes itself.
* **Minimum Sample Size**: At least 5 baseline items are required before declaring performance directions.

---

## 2. Velocity Metrics (Age-Normalized)

To compute velocity without division by zero or distortion on brand new posts:
$$\text{effectiveAgeHours} = \max(\text{ageHours}, 1.0)$$

### 2.1 Views Per Hour (Reels & Video Posts)
$$\text{viewsPerHour} = \frac{\text{views}}{\text{effectiveAgeHours}}$$
*(If views is null, viewsPerHour is null).*

### 2.2 Engagement Per Hour (All Content)
$$\text{totalEngagement} = \text{reactions} + \text{comments} + \text{shares}$$
$$\text{engagementPerHour} = \frac{\text{totalEngagement}}{\text{effectiveAgeHours}}$$
*(If totalEngagement is null, engagementPerHour is null).*

---

## 3. Baseline Computation

### 3.1 Baseline Selection
* **Default Pool**: The most recent **20 items** of the same content type (`post` or `reel`) from the same Facebook Page, excluding the item being evaluated.
* **Configurable Sizes**: Last 10, 20, 50, 100, or All Historical Data.
* **Cold Start Protection**:
  $$\text{if } N_{\text{baseline}} < 5 \implies \text{performancePercent} = \text{null}, \; \text{performanceDirection} = \text{"unknown"}$$
  The UI displays: *"Insufficient baseline data (need at least 5 items)"*.

### 3.2 Metric Deviation Calculation
For any specific metric $M$ (e.g. Views, Engagement, Shares):
$$\Delta\%(M) = \frac{M_{\text{current}} - \bar{M}_{\text{baseline}}}{\bar{M}_{\text{baseline}}} \times 100$$
Where $\bar{M}_{\text{baseline}}$ is the arithmetic mean of valid, non-null values in the baseline pool.

---

## 4. Combined Weighted Performance Score

### 4.1 Reels Weighted Formula
Reels prioritize reach and virality. The default weights are:
* **Views Deviation ($\Delta\%(\text{views})$)**: 40% ($w_1 = 0.40$)
* **Engagement Deviation ($\Delta\%(\text{engagement})$)**: 30% ($w_2 = 0.30$)
* **Engagement Rate Deviation ($\Delta\%(\text{rate})$)**: 20% ($w_3 = 0.20$)
* **Share Deviation ($\Delta\%(\text{shares})$)**: 10% ($w_4 = 0.10$)

$$\text{performancePercent}_{\text{reel}} = \sum_{i} \left( w_i \times \Delta\%(M_i) \right)$$
*(If an individual metric is null in the current item, its weight is dynamically redistributed proportionally among the available metrics).*

### 4.2 Posts Weighted Formula
Posts prioritize conversational engagement and amplification:
* **Engagement Deviation ($\Delta\%(\text{engagement})$)**: 50% ($w_1 = 0.50$)
* **Engagement Per Hour ($\Delta\%(\text{engagementPerHour})$)**: 30% ($w_2 = 0.30$)
* **Comments Deviation ($\Delta\%(\text{comments})$)**: 10% ($w_3 = 0.10$)
* **Shares Deviation ($\Delta\%(\text{shares})$)**: 10% ($w_4 = 0.10$)

$$\text{performancePercent}_{\text{post}} = \sum_{i} \left( w_i \times \Delta\%(M_i) \right)$$

---

## 5. Direction & Classification Labels

### 5.1 Directional Thresholds
* **`up`**: $\text{performancePercent} > +10.0\%$
* **`down`**: $\text{performancePercent} < -10.0\%$
* **`neutral`**: $-10.0\% \le \text{performancePercent} \le +10.0\%$
* **`unknown`**: Insufficient baseline items ($< 5$).

### 5.2 Performance Rating Labels
* **`Excellent`**: $\text{performancePercent} \ge +50.0\%$ (Green badge)
* **`Above Average`**: $+15.0\% \le \text{performancePercent} < +50.0\%$ (Emerald badge)
* **`Average`**: $-15.0\% < \text{performancePercent} < +15.0\%$ (Gray badge)
* **`Below Average`**: $-50.0\% \le \text{performancePercent} \le -15.0\%$ (Orange badge)
* **`Poor`**: $\text{performancePercent} < -50.0\%$ (Red badge)
* **`Insufficient Data`**: Fewer than 5 baseline items available.
