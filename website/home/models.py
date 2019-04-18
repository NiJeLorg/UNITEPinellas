from django.db import models

from wagtail.snippets.models import register_snippet

from wagtail.core.models import Page
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel

from reports.models import ReportPage
from faqs.models import FaqPage
from partners.models import PartnerPage



class HomePage(Page):
    headline = models.CharField(max_length=1000)
    sub_headline_1 = models.CharField(max_length=250)
    tooltip_1 = models.CharField(max_length=250)
    sub_headline_2 = models.CharField(max_length=250)
    tooltip_2 = models.CharField(max_length=250)
    sub_headline_3 = models.CharField(max_length=250)
    tooltip_3 = models.CharField(max_length=250)
    
    content_panels = Page.content_panels + [
        FieldPanel('headline'),
        FieldPanel('sub_headline_1'),
        FieldPanel('tooltip_1'),
        FieldPanel('sub_headline_2'),
        FieldPanel('tooltip_2'),
        FieldPanel('sub_headline_3'),
        FieldPanel('tooltip_3'),
    ]

    def reports(self):
        reports = ReportPage.objects.live().order_by('-date')
        return reports

    def faqs(self):
        faqs = FaqPage.objects.live().order_by('pk')
        return faqs

    def inviters(self):
        inviters = PartnerPage.objects.live().order_by('name').filter(category__category__iexact='Equity Profile Co-Inviters')
        return inviters

    def funders(self):
        funders = PartnerPage.objects.live().order_by('name').filter(category__category__iexact='Collective Funders')
        return funders        

    def members(self):
        members = PartnerPage.objects.live().order_by('name').filter(category__category__iexact='Collective Members')
        return members   


@register_snippet
class Footer(models.Model):
    subscribe = models.CharField(max_length=250)
    questions = models.CharField(max_length=250)
    contact = RichTextField(blank=True)

    panels = [
        FieldPanel('subscribe'),
        FieldPanel('questions'),
        FieldPanel('contact'),
    ]

    def __str__(self):
        return self.subscribe

