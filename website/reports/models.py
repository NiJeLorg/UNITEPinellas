from django.db import models

from modelcluster.fields import ParentalKey
from modelcluster.contrib.taggit import ClusterTaggableManager
from taggit.models import TaggedItemBase

from wagtail.core.models import Page
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel, MultiFieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.documents.models import Document
from wagtail.documents.edit_handlers import DocumentChooserPanel
from wagtail.search import index


class ReportIndexPage(Page):
    intro = RichTextField(blank=True)

    def get_context(self, request):
        # Update context to include only published posts, ordered by reverse-chron
        context = super().get_context(request)
        reportpages = self.get_children().live().order_by('-first_published_at')
        context['reportpages'] = reportpages
        return context

class ReportPageTag(TaggedItemBase):
    content_object = ParentalKey(
        'ReportPage',
        related_name='tagged_items',
        on_delete=models.CASCADE
    )

class ReportPage(Page):
    date = models.DateField("Post date")
    summary_document = models.ForeignKey(
        'wagtaildocs.Document',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    full_report_document = models.ForeignKey(
        'wagtaildocs.Document',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    indicator_number = models.CharField(max_length=250)
    indicator_caption = models.CharField(max_length=250)
    body = RichTextField(blank=True)
    tags = ClusterTaggableManager(through=ReportPageTag, blank=True)

    search_fields = Page.search_fields + [
        index.SearchField('indicator_caption'),
        index.SearchField('body'),
    ]

    content_panels = Page.content_panels + [
        MultiFieldPanel([
            FieldPanel('date'),
            FieldPanel('tags'),
        ], heading="Report Metadata"),
        DocumentChooserPanel('summary_document'),
        DocumentChooserPanel('full_report_document'),
        FieldPanel('indicator_number'),
        FieldPanel('indicator_caption'),
        FieldPanel('body'),
    ]

class ReportTagIndexPage(Page):

    def get_context(self, request):

        # Filter by tag
        tag = request.GET.get('tag')
        reportpages = ReportPage.objects.filter(tags__name=tag)

        # Update template context
        context = super().get_context(request)
        context['reportpages'] = reportpages
        return context
